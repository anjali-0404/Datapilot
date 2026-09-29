import random
from typing import List
from urllib.parse import quote

from utils.common import CompanyTerms, Record, clean_text, create_page, dedupe_records, human_delay, launch_browser, today


async def collect(company_terms: CompanyTerms, logger, max_records: int = 50) -> List[Record]:
    logger.info("Collecting BBC News")
    records: List[Record] = []
    playwright, browser = await launch_browser(headless=True)
    page = await create_page(browser)
    try:
        for company, terms in company_terms.items():
            for term in terms[:3]:
                url = "https://www.bbc.co.uk/search?q=" + quote(term)
                try:
                    await human_delay(2, 5)
                    await page.goto(url, timeout=90000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(random.randint(3000, 5000))
                    raw_articles = []
                    for selector in ("article", '[data-testid="default-promo"]', '[data-testid="newport-card"]'):
                        try:
                            raw_articles.extend(await page.locator(selector).all_inner_texts())
                        except Exception:
                            pass
                    for text in raw_articles:
                        text = clean_text(text)
                        lower = text.lower()
                        if len(text) < 60 or any(x in lower for x in ("bbc homepage", "cookies", "terms of use")):
                            continue
                        records.append(
                            {
                                "platform": "bbcnews",
                                "source": url,
                                "source_url": url,
                                "scraped_at": today(),
                                "companies": [company],
                                "query": term,
                                "text": text[:5000],
                            }
                        )
                        if len(records) >= max_records:
                            break
                except Exception as exc:
                    logger.warning("BBC News failed for %s: %s", term, exc)
    finally:
        await page.close()
        await browser.close()
        await playwright.stop()
    return dedupe_records(records)