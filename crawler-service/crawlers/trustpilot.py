import asyncio
import random
from typing import List
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

from utils.common import CompanyTerms, Record, clean_text, today, random_user_agent


async def collect(company_terms: CompanyTerms, logger, max_records: int = 50) -> List[Record]:
    logger.info("Collecting Trustpilot")
    records: List[Record] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=random_user_agent(),
            viewport={'width': 1920, 'height': 1080}
        )
        page = await context.new_page()

        try:
            for company, terms in company_terms.items():
                # Use company name as domain for Trustpilot
                domain = company.lower().replace(" ", "")
                if "." not in domain:
                    domain = f"{domain}.com"

                target_url = f"https://www.trustpilot.com/review/{domain}"
                logger.info(f"Scraping Trustpilot for: {target_url}")

                try:
                    await page.goto(target_url, wait_until="networkidle", timeout=60000)
                    await asyncio.sleep(random.uniform(2, 4))

                    collected_count = 0
                    page_num = 1

                    while collected_count < max_records:
                        logger.info(f"Processing Trustpilot page {page_num}...")

                        # Check for Cloudflare/CAPTCHA
                        content = await page.content()
                        if "Cloudflare" in content or "Checking your browser" in content:
                            logger.warning("Cloudflare/Bot detection detected. Stopping.")
                            break

                        # Human-like scrolling
                        for _ in range(random.randint(2, 4)):
                            await page.mouse.wheel(0, random.randint(300, 700))
                            await asyncio.sleep(random.uniform(0.5, 1.2))

                        soup = BeautifulSoup(await page.content(), "html.parser")
                        review_cards = soup.select('article[data-service-review-card-paper="true"]')

                        if not review_cards:
                            logger.warning("No review cards found. Might be blocked.")
                            break

                        for card in review_cards:
                            if collected_count >= max_records:
                                break

                            body_elem = card.select_one('[data-service-review-text-typography="true"]')
                            body = clean_text(body_elem.get_text()) if body_elem else ""

                            if len(body) < 50:
                                continue

                            title_elem = card.select_one('[data-service-review-title-typography="true"]')
                            title = title_elem.get_text().strip() if title_elem else ""
                            date_elem = card.select_one('time')

                            records.append(
                                {
                                    "platform": "trustpilot",
                                    "source": target_url,
                                    "scraped_at": today(),
                                    "companies": [company],
                                    "title": title,
                                    "text": f"{title}. {body}".strip()[:5000],
                                }
                            )
                            collected_count += 1

                        # Pagination
                        try:
                            modal_close = page.locator('button[class*="Modal_close"], div[class*="Modal_overlay"], button[aria-label*="Close"]').first
                            if await modal_close.count() > 0 and await modal_close.is_visible():
                                await modal_close.click(force=True)
                                await asyncio.sleep(1)

                            next_button = page.locator('a[name="pagination-button-next"]')
                            if await next_button.count() > 0 and await next_button.is_visible() and collected_count < max_records:
                                await next_button.click(force=True)
                                await page.wait_for_load_state("networkidle")
                                page_num += 1
                                await asyncio.sleep(random.uniform(2, 4))
                            else:
                                break
                        except Exception:
                            break

                except Exception as exc:
                    logger.warning("Trustpilot failed for %s: %s", company, exc)

        except Exception as e:
            logger.error(f"Trustpilot extraction failed: {e}")
        finally:
            await browser.close()

    from utils.common import dedupe_records
    return dedupe_records(records)[:max_records]