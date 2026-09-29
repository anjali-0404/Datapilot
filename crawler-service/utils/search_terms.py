import json
import logging
import re
from typing import Dict, List, Optional
from urllib.parse import quote_plus

import aiohttp

try:
    import feedparser
except ImportError:
    feedparser = None

from .common import DEFAULT_HEADERS, clean_text, env


FALLBACK_SUFFIXES = [
    "news",
    "reviews",
    "security",
    "privacy",
    "product",
    "stock",
    "earnings",
    "customer complaints",
    "controversy",
    "latest updates",
]


def _normalize_terms(company: str, terms: List[str], limit: int) -> List[str]:
    seen = set()
    output = []
    for term in [company, *terms]:
        term = clean_text(term).lower().strip(" -:,.")
        if not term or len(term) < 2:
            continue
        if term in seen:
            continue
        seen.add(term)
        output.append(term)
        if len(output) >= limit:
            break
    return output


async def terms_from_google_news(company: str, limit: int = 20) -> List[str]:
    if feedparser is None:
        return []
    rss_url = f"https://news.google.com/rss/search?q={quote_plus(company)}&hl=en-US&gl=US&ceid=US:en"
    feed = feedparser.parse(rss_url)
    candidates = []
    for entry in feed.entries[:30]:
        title = clean_text(entry.get("title", ""))
        title = re.sub(r"\s+-\s+[^-]+$", "", title)
        words = re.findall(r"[A-Za-z][A-Za-z0-9&.+-]{1,}", title)
        if not words:
            continue
        candidates.append(" ".join(words[:6]))
    return _normalize_terms(company, candidates, limit)


async def terms_from_nim(company: str, limit: int = 20, logger: Optional[logging.Logger] = None) -> List[str]:
    api_key = env("NVIDIA_API_KEY") or env("NVIDIA_NIM_API_KEY")
    if not api_key:
        return []

    base_url = env("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
    model = env("NVIDIA_NIM_MODEL", "meta/llama-3.1-70b-instruct")
    url = f"{base_url.rstrip('/')}/chat/completions"
    prompt = (
        f"Return exactly {limit} recent, specific, relevant internet search terms for "
        f"collecting public sentiment and reputation data about {company}. "
        "Return only a JSON array of strings."
    )
    headers = {**DEFAULT_HEADERS, "Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 700,
    }

    try:
        async with aiohttp.ClientSession(headers=headers, timeout=aiohttp.ClientTimeout(total=60)) as session:
            async with session.post(url, json=payload) as response:
                if response.status >= 400:
                    if logger:
                        logger.warning("NIM term lookup failed for %s: HTTP %s", company, response.status)
                    return []
                data = await response.json()
        content = data["choices"][0]["message"]["content"]
        match = re.search(r"\[[\s\S]*\]", content)
        terms = json.loads(match.group(0) if match else content)
        return _normalize_terms(company, [str(term) for term in terms], limit)
    except Exception as exc:
        if logger:
            logger.warning("NIM term lookup failed for %s: %s", company, exc)
        return []


async def build_company_terms(
    companies: List[str],
    limit: int = 20,
    source: str = "auto",
    logger: Optional[logging.Logger] = None,
) -> Dict[str, List[str]]:
    terms_by_company: Dict[str, List[str]] = {}
    for company in companies:
        terms: List[str] = []
        if source in {"auto", "nim"}:
            terms = await terms_from_nim(company, limit, logger)
        if not terms and source in {"auto", "internet"}:
            try:
                terms = await terms_from_google_news(company, limit)
            except Exception as exc:
                if logger:
                    logger.warning("Internet term lookup failed for %s: %s", company, exc)
        if not terms:
            terms = _normalize_terms(company, [f"{company} {suffix}" for suffix in FALLBACK_SUFFIXES], limit)
        terms_by_company[company] = terms
    return terms_by_company