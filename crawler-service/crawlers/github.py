import asyncio
import logging
from typing import List

from utils.common import CompanyTerms, Record, create_http_session, today, match_companies, clean_text


logger = logging.getLogger("github")


async def _search_github(session, query: str, per_page: int = 30) -> List[dict]:
    """Search GitHub repositories using public API."""
    url = "https://api.github.com/search/repositories"
    params = {"q": query, "sort": "stars", "order": "desc", "per_page": per_page}
    try:
        async with session.get(url, params=params) as response:
            if response.status >= 400:
                if response.status == 403:
                    logger.warning("GitHub API rate limited")
                return []
            data = await response.json()
            return data.get("items", [])
    except Exception:
        return []


async def _fetch_repo_details(session, owner: str, repo: str) -> dict:
    """Fetch repository details including description and topics."""
    url = f"https://api.github.com/repos/{owner}/{repo}"
    try:
        async with session.get(url) as response:
            if response.status >= 400:
                return {}
            return await response.json()
    except Exception:
        return {}


async def collect(company_terms: CompanyTerms, logger, max_records: int = 50) -> List[Record]:
    logger.info("Collecting GitHub")
    records: List[Record] = []

    async with await create_http_session(timeout=30) as session:
        for company, terms in company_terms.items():
            for term in terms[:3]:
                query = f"{term} {company}"
                try:
                    repos = await _search_github(session, query, per_page=20)

                    for repo in repos:
                        details = await _fetch_repo_details(session, repo["owner"]["login"], repo["name"])
                        description = details.get("description", "") or repo.get("description", "")
                        topics = details.get("topics", [])
                        readme = ""

                        # Try to get README
                        readme_url = f"https://api.github.com/repos/{repo['owner']['login']}/{repo['name']}/readme"
                        try:
                            async with session.get(readme_url) as resp:
                                if resp.status == 200:
                                    readme_data = await resp.json()
                                    import base64
                                    readme = base64.b64decode(readme_data.get("content", "")).decode("utf-8", errors="ignore")[:2000]
                        except Exception:
                            pass

                        text_parts = [repo["name"], description, " ".join(topics), readme]
                        text = clean_text(" ".join(filter(None, text_parts)))

                        if len(text) < 30:
                            continue
                        if not match_companies(text, {company: terms}):
                            continue

                        records.append(
                            {
                                "platform": "github",
                                "source": repo["html_url"],
                                "url": repo["html_url"],
                                "scraped_at": today(),
                                "companies": [company],
                                "query": term,
                                "title": f"{repo['owner']['login']}/{repo['name']}",
                                "text": text[:5000],
                            }
                        )
                        if len(records) >= max_records:
                            break

                    await asyncio.sleep(1)
                except Exception as exc:
                    logger.warning("GitHub failed for %s: %s", term, exc)

    from utils.common import dedupe_records
    return dedupe_records(records)[:max_records]