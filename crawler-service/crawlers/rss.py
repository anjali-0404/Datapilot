import asyncio
from typing import List

try:
    import feedparser
except ImportError:
    feedparser = None

from utils.common import CompanyTerms, Record, clean_text, create_http_session, match_companies, today


RSS_FEEDS = [
    "https://techcrunch.com/feed/",
    "https://feeds.feedburner.com/TheHackersNews",
    "https://www.theverge.com/rss/index.xml",
    "https://hnrss.org/frontpage",
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://feeds.arstechnica.com/arstechnica/index",
    "https://www.wired.com/feed/rss",
    "https://www.engadget.com/rss.xml",
    "https://mashable.com/feeds/rss/all",
    "https://www.zdnet.com/news/rss.xml",
    "https://venturebeat.com/feed/",
    "https://www.businessinsider.com/rss",
    "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
    "https://feeds.bbci.co.uk/news/technology/rss.xml",
]


async def _fetch_article_text(session, url: str) -> str:
    if not url:
        return ""
    try:
        async with session.get(url) as response:
            if response.status >= 400:
                return ""
            html = await response.text(errors="replace")
    except Exception:
        return ""
    return clean_text(html)[:7000]


async def collect(company_terms: CompanyTerms, logger, max_records: int = 50) -> List[Record]:
    if feedparser is None:
        logger.warning("Skipping RSS: feedparser is not installed")
        return []

    logger.info("Collecting RSS feeds")
    records: List[Record] = []
    pending = []
    for feed_url in RSS_FEEDS:
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:20]:
                seed = clean_text(f"{entry.get('title', '')}. {entry.get('summary', '')}")
                matched = match_companies(seed, company_terms)
                if not matched:
                    continue
                pending.append((feed_url, entry, seed, matched))
        except Exception as exc:
            logger.warning("RSS feed failed %s: %s", feed_url, exc)

    async with await create_http_session(timeout=30) as session:
        article_texts = await asyncio.gather(
            *[_fetch_article_text(session, entry.get("link", "")) for _, entry, _, _ in pending],
            return_exceptions=True,
        )

    for (feed_url, entry, seed, matched), article_text in zip(pending, article_texts):
        text = article_text if isinstance(article_text, str) and len(article_text) >= 200 else seed
        if len(text) < 40:
            continue
        records.append(
            {
                "platform": "rss",
                "source": feed_url,
                # Article-level URL + headline: without these the row's Name and
                # provenance fell back to the raw feed URL.
                "source_url": entry.get("link", ""),
                "title": clean_text(entry.get("title", ""))[:200],
                "companies": matched,
                "scraped_at": today(),
                "text": text,
            }
        )
        if len(records) >= max_records:
            break
    logger.info("RSS records: %s", len(records))
    return records