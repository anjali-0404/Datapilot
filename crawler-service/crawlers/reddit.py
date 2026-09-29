import asyncio
import random
from datetime import datetime
from typing import List, Dict, Any

from utils.common import CompanyTerms, Record, create_http_session, match_companies, today, clean_text


class RedditPublicJSONCollector:
    """Production-oriented Reddit collector using public JSON endpoints. NO OAUTH OR API KEYS REQUIRED."""

    def __init__(self):
        self.base_url = "https://www.reddit.com"
        self.session = None

    async def __aenter__(self):
        self.session = await create_http_session(timeout=30)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def fetch_json(self, url: str, params: Dict = None) -> Dict[str, Any]:
        try:
            async with self.session.get(url, params=params) as response:
                if response.status == 429:
                    await asyncio.sleep(5)
                    return await self.fetch_json(url, params)
                if response.status >= 400:
                    return None
                return await response.json()
        except Exception as e:
            return None

    async def search(self, query: str, limit: int = 100) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/search.json"
        params = {
            "q": query,
            "limit": min(limit, 100),
            "sort": "relevance",
            "t": "all"
        }

        posts = []
        after = None

        while len(posts) < limit:
            if after:
                params["after"] = after

            data = await self.fetch_json(url, params=params)
            if not data:
                break

            children = data.get("data", {}).get("children", [])
            for child in children:
                posts.append(child["data"])
                if len(posts) >= limit:
                    break

            after = data.get("data", {}).get("after")
            if not after or not children:
                break

        return posts

    async def get_comments(self, permalink: str) -> List[Dict[str, Any]]:
        if not permalink.endswith(".json"):
            url = f"{self.base_url}{permalink.rstrip('/')}.json"
        else:
            url = f"{self.base_url}{permalink}"

        data = await self.fetch_json(url)

        if not data or not isinstance(data, list) or len(data) < 2:
            return []

        comment_listing = data[1]
        raw_comments = comment_listing.get("data", {}).get("children", [])

        flattened_comments = []
        self._extract_comments_recursive(raw_comments, flattened_comments)
        return flattened_comments

    def _extract_comments_recursive(self, children: List[Dict], results: List[Dict]):
        for child in children:
            if child.get("kind") == "t1":
                data = child.get("data", {})

                if data.get("author") in ["[deleted]", "AutoModerator"]:
                    continue
                if not data.get("body") or data.get("body") == "[removed]":
                    continue

                results.append(data)

                replies = data.get("replies")
                if replies and isinstance(replies, dict):
                    inner_children = replies.get("data", {}).get("children", [])
                    self._extract_comments_recursive(inner_children, results)


async def collect(company_terms: CompanyTerms, logger, max_records: int = 50) -> List[Record]:
    logger.info("Collecting Reddit")
    records: List[Record] = []

    async with RedditPublicJSONCollector() as collector:
        for company, terms in company_terms.items():
            for term in terms[:3]:
                try:
                    posts = await collector.search(term, limit=20)
                    for post in posts:
                        if post.get("selftext"):
                            records.append(
                                {
                                    "platform": "reddit",
                                    "source": f"https://www.reddit.com{post.get('permalink', '')}",
                                    "url": f"https://www.reddit.com{post.get('permalink', '')}",
                                    "scraped_at": today(),
                                    "companies": [company],
                                    "query": term,
                                    "title": post.get("title", ""),
                                    "text": clean_text(post["selftext"])[:5000],
                                }
                            )
                            if len(records) >= max_records:
                                break

                        comments = await collector.get_comments(post.get("permalink", ""))
                        for comment in comments[:10]:
                            records.append(
                                {
                                    "platform": "reddit",
                                    "source": f"https://www.reddit.com{post.get('permalink', '')}",
                                    "url": f"https://www.reddit.com{post.get('permalink', '')}",
                                    "scraped_at": today(),
                                    "companies": [company],
                                    "query": term,
                                    "text": clean_text(comment.get("body", ""))[:5000],
                                }
                            )
                            if len(records) >= max_records:
                                break

                        await asyncio.sleep(random.uniform(0.5, 1.5))
                except Exception as exc:
                    logger.warning("Reddit failed for %s: %s", term, exc)

    from utils.common import dedupe_records
    return dedupe_records(records)[:max_records]