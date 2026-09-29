import asyncio
from typing import List, Dict, Any

from utils.common import CompanyTerms, Record, create_http_session, match_companies, today, clean_text


async def collect(company_terms: CompanyTerms, logger, max_records: int = 50) -> List[Record]:
    logger.info("Collecting Hacker News (HN)")
    records: List[Record] = []

    async with await create_http_session(timeout=30) as session:
        for company, terms in company_terms.items():
            for term in terms[:3]:
                try:
                    # Search HN via Algolia API
                    url = "https://hn.algolia.com/api/v1/search"
                    params = {"query": term, "tags": "story", "hitsPerPage": 20}
                    async with session.get(url, params=params) as response:
                        if response.status >= 400:
                            continue
                        data = await response.json()

                    for hit in data.get("hits", []):
                        title = hit.get("title", "")
                        text = hit.get("story_text") or hit.get("title", "")
                        text = clean_text(text)
                        if len(text) < 30:
                            continue
                        if not match_companies(text, {company: terms}):
                            continue

                        records.append(
                            {
                                "platform": "hackernews",
                                "source": f"https://news.ycombinator.com/item?id={hit.get('objectID')}",
                                "url": hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}",
                                "scraped_at": today(),
                                "companies": [company],
                                "query": term,
                                "title": title,
                                "text": text[:5000],
                            }
                        )
                        if len(records) >= max_records:
                            break

                    await asyncio.sleep(0.5)
                except Exception as exc:
                    logger.warning("Hacker News failed for %s: %s", term, exc)

    from utils.common import dedupe_records
    return dedupe_records(records)[:max_records]