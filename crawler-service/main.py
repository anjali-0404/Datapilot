import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import settings
from schemas import CrawlRequest, CrawlResponse, CrawlJobStatus
from orchestrator import run_crawl

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s"
)
logger = logging.getLogger("crawler-service")

# In-memory job store (replace with Redis/DB in production)
crawl_jobs: Dict[str, CrawlJobStatus] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Crawler service starting up...")
    # Install Playwright browsers if needed
    try:
        import subprocess
        subprocess.run(["playwright", "install", "chromium"], check=False, capture_output=True)
    except Exception:
        pass
    yield
    logger.info("Crawler service shutting down...")


app = FastAPI(
    title="DataPilot Crawler Service",
    description="Live web crawling microservice for DataPilot AI",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CrawlRequestWrapper(BaseModel):
    """Wrapper for FastAPI to accept the request body."""
    intent: dict
    platforms: Optional[list] = None
    max_records_per_platform: int = 50
    enabled_categories: Optional[list] = None


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "crawler-service",
        "version": "1.0.0",
        "enabled_platforms": list(settings.ENABLED_PLATFORMS),
    }


@app.get("/platforms")
async def list_platforms():
    from schemas import PLATFORM_CATEGORIES, PLATFORM_DISPLAY_NAMES
    return {
        "platforms": [
            {
                "id": pid,
                "name": PLATFORM_DISPLAY_NAMES.get(pid, pid),
                "category": PLATFORM_CATEGORIES.get(pid, "unknown").value,
            }
            for pid in settings.ENABLED_PLATFORMS
        ]
    }


@app.post("/crawl", response_model=CrawlResponse)
async def crawl(request: CrawlRequestWrapper):
    """Synchronous crawl endpoint - runs all collectors and returns results."""
    from schemas import CrawlRequest as SchemaCrawlRequest, ExtractedIntent, PlatformCategory

    # Convert dict to proper models
    intent = ExtractedIntent(**request.intent)
    enabled_categories = None
    if request.enabled_categories:
        enabled_categories = [PlatformCategory(c) for c in request.enabled_categories]

    crawl_request = SchemaCrawlRequest(
        intent=intent,
        platforms=request.platforms,
        max_records_per_platform=request.max_records_per_platform,
        enabled_categories=enabled_categories,
    )

    try:
        result = await run_crawl(crawl_request, logger)
        return result
    except Exception as e:
        logger.exception("Crawl failed")
        raise HTTPException(status_code=500, detail=str(e))


# Async job endpoints
@app.post("/crawl/async", response_model=CrawlJobStatus)
async def start_async_crawl(request: CrawlRequestWrapper, background_tasks: BackgroundTasks):
    """Start an async crawl job."""
    job_id = str(uuid.uuid4())
    job = CrawlJobStatus(
        job_id=job_id,
        status="pending",
        progress=0,
        records_collected=0,
        started_at=datetime.now(),
    )
    crawl_jobs[job_id] = job

    background_tasks.add_task(run_async_crawl, job_id, request)
    return job


async def run_async_crawl(job_id: str, request: CrawlRequestWrapper):
    """Background task for async crawl."""
    job = crawl_jobs[job_id]
    job.status = "running"
    job.progress = 10

    try:
        from schemas import CrawlRequest as SchemaCrawlRequest, ExtractedIntent, PlatformCategory

        intent = ExtractedIntent(**request.intent)
        enabled_categories = None
        if request.enabled_categories:
            enabled_categories = [PlatformCategory(c) for c in request.enabled_categories]

        crawl_request = SchemaCrawlRequest(
            intent=intent,
            platforms=request.platforms,
            max_records_per_platform=request.max_records_per_platform,
            enabled_categories=enabled_categories,
        )

        job.current_platform = "initializing"
        job.progress = 20

        result = await run_crawl(crawl_request, logger)

        job.records_collected = result.total_records
        job.progress = 100
        job.status = "completed"
        job.completed_at = datetime.now()

    except Exception as e:
        logger.exception(f"Async crawl {job_id} failed")
        job.status = "failed"
        job.error = str(e)
        job.completed_at = datetime.now()


@app.get("/crawl/async/{job_id}", response_model=CrawlJobStatus)
async def get_crawl_job(job_id: str):
    """Get status of an async crawl job."""
    if job_id not in crawl_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return crawl_jobs[job_id]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        log_level=settings.LOG_LEVEL.lower(),
        reload=False,
    )