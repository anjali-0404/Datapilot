import asyncio
import json
import logging
import os
import random
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple

import aiohttp
from bs4 import BeautifulSoup

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


CompanyTerms = Dict[str, List[str]]
Record = Dict[str, Any]


DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

USER_AGENTS = [
    DEFAULT_HEADERS["User-Agent"],
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/16.0 Mobile/15E148 Safari/604.1"
    ),
]


def load_environment() -> None:
    if load_dotenv:
        load_dotenv()


def normalize_company(raw: str) -> str:
    return re.sub(r"\s+", " ", raw.strip().strip(":").lower())


def clean_text(text: Optional[str]) -> str:
    if not text:
        return ""
    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("\x00", " ")
    return re.sub(r"\s+", " ", text).strip()


def keyword_in_text(keyword: str, text: str) -> bool:
    pattern = r"\b" + re.escape(keyword.lower()) + r"\b"
    return re.search(pattern, text.lower()) is not None


def match_companies(text: str, company_terms: Mapping[str, Iterable[str]]) -> List[str]:
    return [
        company
        for company, terms in company_terms.items()
        if any(keyword_in_text(term, text) for term in terms)
    ]


def dedupe_records(records: Iterable[Record]) -> List[Record]:
    seen = set()
    output = []
    for record in records:
        sig = (
            record.get("platform", ""),
            record.get("source", ""),
            record.get("text", "")[:400],
        )
        if sig in seen:
            continue
        seen.add(sig)
        output.append(record)
    return output


def make_corpus(companies: Iterable[str]) -> Dict[str, Dict[str, Any]]:
    return {company: {"platforms": {}} for company in companies}


def records_to_corpus(records: Iterable[Record], company_terms: CompanyTerms) -> Dict[str, Dict[str, Any]]:
    corpus = make_corpus(company_terms)
    for record in dedupe_records(records):
        text = record.get("text", "")
        matched = record.get("companies") or match_companies(text, company_terms)
        for company in matched:
            if company not in corpus:
                continue
            platform = record.get("platform", "unknown")
            source = record.get("source", "unknown")
            scraped_at = record.get("scraped_at") or str(date.today())
            platform_bucket = corpus[company]["platforms"].setdefault(platform, [])
            source_bucket = next((item for item in platform_bucket if item["source"] == source), None)
            if source_bucket is None:
                source_bucket = {"scraped_at": scraped_at, "source": source, "content": []}
                platform_bucket.append(source_bucket)
            if text and text not in source_bucket["content"]:
                source_bucket["content"].append(text)
    return corpus


def build_metadata(corpus: Mapping[str, Any], company_terms: CompanyTerms, enabled_platforms: List[str]) -> Dict[str, Any]:
    sources: Dict[str, Dict[str, Dict[str, int]]] = {}
    total_records = 0
    for company, bucket in corpus.items():
        sources[company] = {}
        for platform, source_list in bucket.get("platforms", {}).items():
            sources[company].setdefault(platform, {})
            for source_entry in source_list:
                count = len(source_entry.get("content", []))
                sources[company][platform][source_entry.get("source", "unknown")] = count
                total_records += count

    return {
        "created_at": str(datetime.now()),
        "finished_at": str(datetime.now()),
        "total_records": total_records,
        "enabled_platforms": enabled_platforms,
        "terms": company_terms,
        "sources": sources,
    }


def write_outputs(
    corpus: Mapping[str, Any],
    metadata: Mapping[str, Any],
    output_dir: Path,
    single_file: bool = False,
) -> List[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    written = []
    if single_file:
        filename = output_dir / f"companies_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        payload = {**corpus, "_metadata": metadata}
        filename.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        return [filename]

    for company, bucket in corpus.items():
        filename = output_dir / f"{company}.json"
        payload = {company: bucket, "_metadata": metadata}
        filename.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        written.append(filename)
    return written


def setup_logging(log_dir: Path, name: str = "crawler") -> logging.Logger:
    log_dir.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    logger.handlers.clear()

    formatter = logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
    file_handler = logging.FileHandler(
        log_dir / f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log",
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    return logger


async def human_delay(a: float = 1.5, b: float = 4.0) -> None:
    await asyncio.sleep(random.uniform(a, b))


def today() -> str:
    return date.today().strftime("%Y-%m-%d")


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default)


def random_user_agent() -> str:
    return random.choice(USER_AGENTS)


async def create_http_session(timeout: int = 60) -> aiohttp.ClientSession:
    return aiohttp.ClientSession(
        headers=DEFAULT_HEADERS,
        timeout=aiohttp.ClientTimeout(total=timeout),
    )


async def launch_browser(headless: bool = True):
    from playwright.async_api import async_playwright

    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=headless)
    return playwright, browser


async def create_page(browser):
    context = await browser.new_context(
        viewport={"width": 1440, "height": 1200},
        locale="en-US",
        user_agent=random_user_agent(),
        extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
    )
    page = await context.new_page()
    await page.add_init_script(
        """
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
        """
    )
    return page


async def collect_simple_page(
    company_terms: CompanyTerms,
    logger,
    platform: str,
    url: str,
    selectors: List[str],
    min_length: int = 25,
) -> List[Record]:
    logger.info("Collecting %s", platform)
    records: List[Record] = []
    playwright, browser = await launch_browser(headless=True)
    page = await create_page(browser)
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(4000)
        raw: List[str] = []
        for selector in selectors:
            try:
                raw.extend(await page.locator(selector).all_inner_texts())
            except Exception:
                pass
        for text in raw:
            text = clean_text(text)
            lower = text.lower()
            if len(text) < min_length or any(x in lower for x in ("home", "log in", "sign up", "privacy", "terms")):
                continue
            matched = match_companies(text, company_terms)
            if not matched:
                continue
            records.append(
                {
                    "platform": platform,
                    "source": url,
                    "scraped_at": today(),
                    "companies": matched,
                    "text": text[:5000],
                }
            )
    except Exception as exc:
        logger.warning("%s failed: %s", platform, exc)
    finally:
        await page.close()
        await browser.close()
        await playwright.stop()
    return dedupe_records(records)