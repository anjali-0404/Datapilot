from typing import List
from urllib.parse import quote

from utils.common import CompanyTerms, Record, clean_text, create_page, dedupe_records, human_delay, launch_browser, today


async def collect(company_terms: CompanyTerms, logger, max_records: int = 50) -> List[Record]:
    logger.info("Collecting The Hacker News")
    records: List[Record] = []
    playwright, browser = await launch_browser(headless=True)
    page = await create_page(browser)
    try:
        for company, terms in company_terms.items():
            for term in terms[:5]:
                url = f"https://thehackernews.com/search?q={quote(term)}"
                try:
                    await page.goto(url, timeout=90000, wait_until="domcontentloaded")
                    await human_delay(2, 4)
                    articles = await page.locator(".body-post").all_inner_texts()
                    for text in articles:
                        text = clean_text(text)
                        if len(text) < 50:
                            continue
                        records.append(
                            {
                                "platform": "thehackernews",
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
                    logger.warning("The Hacker News failed for %s: %s", term, exc)
    finally:
        await page.close()
        await browser.close()
        await playwright.stop()
    return dedupe_records(records)