import asyncio
import json
import logging
from typing import List

from utils.common import CompanyTerms, Record, create_http_session, today, clean_text


logger = logging.getLogger("appstore")


async def _search_app_store(session, term: str) -> List[dict]:
    """Search App Store using their public API."""
    url = "https://itunes.apple.com/search"
    params = {"term": term, "entity": "software", "country": "US", "limit": 10}
    try:
        async with session.get(url, params=params) as response:
            if response.status >= 400:
                return []
            data = await response.json()
            return data.get("results", [])
    except Exception:
        return []


async def _fetch_app_reviews(session, app_id: str, country: str = "us") -> List[dict]:
    """Fetch reviews for an app from App Store RSS feed."""
    url = f"https://itunes.apple.com/{country}/rss/customerreviews/id={app_id}/sortBy=mostRecent/json"
    try:
        async with session.get(url) as response:
            if response.status >= 400:
                return []
            data = await response.json()
            entries = data.get("feed", {}).get("entry", [])
            # Skip first entry (it's the app info, not a review)
            return entries[1:] if len(entries) > 1 else []
    except Exception:
        return []


async def collect(company_terms: CompanyTerms, logger, max_records: int = 50) -> List[Record]:
    logger.info("Collecting Apple App Store")
    records: List[Record] = []

    async with await create_http_session(timeout=30) as session:
        for company, terms in company_terms.items():
            try:
                logger.info(f"Searching App Store for: {company}")
                apps = await _search_app_store(session, company)

                for app_info in apps[:3]:
                    app_id = app_info.get("id")
                    app_name = app_info.get("name", "")
                    logger.info(f"Fetching reviews for {app_name} ({app_id})...")

                    reviews_data = await _fetch_app_reviews(session, str(app_id))

                    for entry in reviews_data:
                        content = entry.get("content", {}).get("label", "")
                        title = entry.get("title", {}).get("label", "")
                        text = clean_text(f"{title}. {content}")
                        if len(text) < 20:
                            continue

                        records.append(
                            {
                                "platform": "appstore",
                                "source": f"https://apps.apple.com/app/id{app_id}",
                                "url": f"https://apps.apple.com/app/id{app_id}",
                                "scraped_at": today(),
                                "companies": [company],
                                "product": app_name,
                                "title": title,
                                "text": text[:5000],
                            }
                        )
                        if len(records) >= max_records:
                            break

                    if len(records) >= max_records:
                        break

                    await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Error scraping App Store for {company}: {e}")

    from utils.common import dedupe_records
    return dedupe_records(records)[:max_records]