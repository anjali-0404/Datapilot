import importlib
import re
import logging
import time
from typing import List, Optional, Callable, Awaitable

from schemas import CrawlRequest, CrawlResponse, SourceRecord, CompanyTerms
from utils.common import normalize_company
from utils.search_terms import build_company_terms


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


# Words that describe the *request* rather than its subject. Searching the web
# for "find" or "contact" returns unrelated pages, so they are never used as
# crawl subjects.
REQUEST_WORDS = {
    "find", "list", "show", "give", "want", "need", "looking", "search", "collect",
    "get", "with", "from", "that", "this", "these", "those", "their", "them",
    "have", "has", "include", "including", "about", "which", "where", "what",
    "who", "into", "over", "more", "some", "like", "also", "please", "based",
    "top", "best", "all", "any", "and", "for", "the", "are", "our",
    "company", "companies", "organization", "organizations", "organisation",
    "organisations", "firms", "businesses", "contact", "contacts", "email",
    "emails", "details", "website", "websites", "name", "names", "phone",
    "number", "numbers", "industry", "location", "data", "dataset", "info",
    "information", "leads", "lead", "near", "around", "within", "across",
    "say", "says", "think", "thinks", "users", "people", "does", "how", "why",
}

MAX_SUBJECTS = 4


def extract_subjects(intent) -> List[str]:
    """Pick the few goal keywords worth searching for, most specific first."""
    words = [
        w.strip(".-")
        for w in re.findall(r"[A-Za-z0-9][A-Za-z0-9&.+-]*", intent.goal)
    ]
    keywords = [
        (i, w) for i, w in enumerate(words)
        if len(w) > 2 and w.lower() not in REQUEST_WORDS
    ]
    # Capitalised words past the first are usually names (Zerodha, Pune) —
    # the most specific thing to search for — so they go first.
    is_name = lambda iw: iw[0] > 0 and iw[1][0].isupper()
    keywords.sort(key=lambda iw: 0 if is_name(iw) else 1)
    subjects = [normalize_company(w) for _, w in keywords]
    if intent.industry:
        # Right after the names, so a capped list never drops the industry.
        subjects.insert(sum(1 for iw in keywords if is_name(iw)), normalize_company(intent.industry))
    subjects = [s for s in dict.fromkeys(subjects) if s]  # dedupe preserving order
    # The location is a filter, not a topic: crawling "bangalore" on its own
    # returns city news. Keep it only when nothing else is left to search.
    location = normalize_company(intent.location or "")
    topical = [s for s in subjects if s != location]
    return (topical or subjects)[:MAX_SUBJECTS] or [normalize_company(intent.goal)]


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

    companies = extract_subjects(request.intent)

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