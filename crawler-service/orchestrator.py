import importlib
import logging
import time
from typing import Dict, List, Optional, Tuple, Callable, Awaitable

from schemas import CrawlRequest, CrawlResponse, SourceRecord, CompanyTerms
from utils.common import normalize_company
from utils.search_terms import build_company_terms
from config import settings


CollectorFunc = Callable[[CompanyTerms, logging.Logger, int], Awaitable[List[SourceRecord]]]


# Platform module mapping
PLATFORM_MODULES = {
    "rss": "crawlers.rss",
    "bbcnews": "crawlers.bbcnews",
    "thehackernews": "crawlers.thehackernews",
    "reddit": "crawlers.reddit",
    "hackernews": "crawlers.hackernews",
    "trustpilot": "crawlers.trustpilot",
    "googleplay": "crawlers.googleplay",
    "appstore": "crawlers.appstore",
    "github": "crawlers.github",
    # Add more as implemented
}


async def load_collector(platform: str) -> Optional[CollectorFunc]:
    """Dynamically import and return the collect function for a platform."""
    module_name = PLATFORM_MODULES.get(platform)
    if not module_name:
        return None
    try:
        module = importlib.import_module(module_name, package=__package__)
        return module.collect
    except Exception as e:
        logging.getLogger("orchestrator").warning(f"Failed to load {platform}: {e}")
        return None


async def run_crawl(request: CrawlRequest, logger: logging.Logger) -> CrawlResponse:
    """Main orchestrator: build terms, run selected crawlers, aggregate results."""
    start_time = time.time()

    # Normalize companies from intent
    companies = [normalize_company(request.intent.goal)]
    # Extract company names from intent goal if possible
    # For now, use the whole goal as a search term
    companies = [normalize_company(c) for c in request.intent.goal.split() if len(c) > 3]
    companies = list(dict.fromkeys(companies))  # dedupe preserving order
    if not companies:
        companies = [normalize_company(request.intent.goal)]

    logger.info(f"Companies: {companies}")

    # Build search terms
    company_terms = await build_company_terms(
        companies,
        limit=20,
        source="auto",
        logger=logger,
    )
    for company, terms in company_terms.items():
        logger.info(f"Terms for {company}: {', '.join(terms)}")

    # Determine platforms to run
    available_platforms = list(PLATFORM_MODULES.keys())
    if request.enabled_categories:
        from schemas import PLATFORM_CATEGORIES
        available_platforms = [
            p for p in available_platforms
            if PLATFORM_CATEGORIES.get(p) in request.enabled_categories
        ]

    platforms = request.platforms or available_platforms
    platforms = [p for p in platforms if p in PLATFORM_MODULES]

    logger.info(f"Running platforms: {platforms}")

    # Load collectors
    collectors = []
    for platform in platforms:
        collect_func = await load_collector(platform)
        if collect_func:
            collectors.append((platform, collect_func))
        else:
            logger.warning(f"No collector for platform: {platform}")

    # Run collectors
    all_records: List[SourceRecord] = []
    platform_stats = {}
    errors = {}

    for platform, collect_func in collectors:
        try:
            logger.info(f"Starting {platform}...")
            records = await collect_func(company_terms, logger, request.max_records_per_platform)
            all_records.extend(records)
            platform_stats[platform] = len(records)
            logger.info(f"{platform} returned {len(records)} records")
        except Exception as exc:
            logger.exception(f"{platform} failed: {exc}")
            errors[platform] = str(exc)
            platform_stats[platform] = 0

    duration_ms = int((time.time() - start_time) * 1000)
    logger.info(f"Crawl completed in {duration_ms}ms. Total records: {len(all_records)}")

    return CrawlResponse(
        records=all_records,
        platform_stats=platform_stats,
        errors=errors,
        total_records=len(all_records),
        crawl_duration_ms=duration_ms,
    )