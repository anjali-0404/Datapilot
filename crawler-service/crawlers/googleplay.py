from google_play_scraper import app, search, reviews, Sort
import logging
from typing import List

from utils.common import CompanyTerms, Record, today


logger = logging.getLogger("googleplay")


async def collect(company_terms: CompanyTerms, logger, max_records: int = 50) -> List[Record]:
    logger.info("Collecting Google Play Store")
    records: List[Record] = []

    for company, terms in company_terms.items():
        try:
            logger.info(f"Searching Google Play for: {company}")
            search_results = search(company, lang='en', country='us', n_hits=5)

            for res in search_results:
                app_id = res.get('appId')
                app_name = res.get('title')
                logger.info(f"Fetching reviews for {app_name} ({app_id})...")

                try:
                    result, _ = reviews(
                        app_id,
                        lang='en',
                        country='us',
                        sort=Sort.MOST_RELEVANT,
                        count=min(20, max_records // 5)
                    )

                    for r in result:
                        text = r.get('content', '')
                        if text:
                            records.append(
                                {
                                    "platform": "googleplay",
                                    "source": f"https://play.google.com/store/apps/details?id={app_id}",
                                    "url": f"https://play.google.com/store/apps/details?id={app_id}",
                                    "scraped_at": today(),
                                    "companies": [company],
                                    "product": app_name,
                                    "text": text[:5000],
                                }
                            )
                            if len(records) >= max_records:
                                break
                except Exception as e:
                    logger.error(f"Error fetching reviews for {app_id}: {e}")

                if len(records) >= max_records:
                    break

        except Exception as e:
            logger.error(f"Error scraping Google Play for {company}: {e}")

    from utils.common import dedupe_records
    return dedupe_records(records)[:max_records]