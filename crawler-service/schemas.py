from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from typing import List, Optional, Dict, Any, Literal, Mapping, Iterable
from datetime import datetime
from enum import Enum


class PlatformCategory(str, Enum):
    NEWS = "news"
    REVIEWS = "reviews"
    SOCIAL = "social"
    DEV = "dev"


# Type alias for company terms mapping
CompanyTerms = Dict[str, List[str]]


class CrawlRequest(BaseModel):
    """Request from DataPilot to crawl for a specific intent."""
    intent: "ExtractedIntent"
    platforms: Optional[List[str]] = None  # If None, use all enabled
    max_records_per_platform: int = 50
    enabled_categories: Optional[List[PlatformCategory]] = None


class ExtractedIntent(BaseModel):
    # DataPilot (TypeScript) sends camelCase `entityType`; accept both spellings.
    model_config = ConfigDict(populate_by_name=True)

    goal: str
    entity_type: str = Field(alias="entityType")
    location: Optional[str] = None
    industry: Optional[str] = None
    fields: List[str] = []
    constraints: List[str] = []
    confidence: float


class SourceRecord(BaseModel):
    """Raw record from a crawler, before validation/dedup."""
    platform: str
    source: str  # URL or identifier
    # Crawlers emit "url"; DataPilot reads "source_url". Accept both on input
    # (empty string tolerated) and always serialize as source_url.
    source_url: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("source_url", "url")
    )
    scraped_at: str
    companies: List[str] = []
    query: Optional[str] = None
    # Google Play emits the app name as "product"; treat it as the record title
    # so the row's Name is the app, not a keyword or a text snippet.
    title: Optional[str] = Field(default=None, validation_alias=AliasChoices("title", "product"))
    text: str
    raw_metadata: Dict[str, Any] = {}
    confidence_hint: Optional[float] = None  # Crawler's own confidence


class CrawlResponse(BaseModel):
    """Response from crawler-service to DataPilot."""
    records: List[SourceRecord]
    platform_stats: Dict[str, int]  # platform -> count
    errors: Dict[str, str] = {}  # platform -> error message
    total_records: int
    crawl_duration_ms: int


class CrawlJobStatus(BaseModel):
    """For async crawl tracking."""
    job_id: str
    status: Literal["pending", "running", "completed", "failed"]
    progress: int  # 0-100
    current_platform: Optional[str] = None
    records_collected: int = 0
    error: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None


# Platform configurations
PLATFORM_CATEGORIES: Dict[str, PlatformCategory] = {
    # News
    "rss": PlatformCategory.NEWS,
    "bbcnews": PlatformCategory.NEWS,
    "thehackernews": PlatformCategory.NEWS,
    "techmeme": PlatformCategory.NEWS,
    "mashable": PlatformCategory.NEWS,
    # Reviews
    "trustpilot": PlatformCategory.REVIEWS,
    "googleplay": PlatformCategory.REVIEWS,
    "appstore": PlatformCategory.REVIEWS,
    "amazon": PlatformCategory.REVIEWS,
    "yelp": PlatformCategory.REVIEWS,
    "ebay": PlatformCategory.REVIEWS,
    "flipkart": PlatformCategory.REVIEWS,
    # Social/Opinion
    "reddit": PlatformCategory.SOCIAL,
    "hackernews": PlatformCategory.SOCIAL,
    "stackoverflow": PlatformCategory.SOCIAL,
    "medium": PlatformCategory.SOCIAL,
    "devto": PlatformCategory.SOCIAL,
    "quora": PlatformCategory.SOCIAL,
    "substack": PlatformCategory.SOCIAL,
    "bluesky": PlatformCategory.SOCIAL,
    "mastodon": PlatformCategory.SOCIAL,
    "telegram": PlatformCategory.SOCIAL,
    "threads": PlatformCategory.SOCIAL,
    "youtube": PlatformCategory.SOCIAL,
    # Dev
    "github": PlatformCategory.DEV,
    "gitlab": PlatformCategory.DEV,
}


PLATFORM_DISPLAY_NAMES: Dict[str, str] = {
    "rss": "RSS Feeds (14 sources)",
    "bbcnews": "BBC News",
    "thehackernews": "The Hacker News",
    "techmeme": "TechMeme",
    "mashable": "Mashable",
    "trustpilot": "Trustpilot",
    "googleplay": "Google Play Store",
    "appstore": "Apple App Store",
    "amazon": "Amazon Reviews",
    "yelp": "Yelp",
    "ebay": "eBay",
    "flipkart": "Flipkart",
    "reddit": "Reddit",
    "hackernews": "Hacker News (HN)",
    "stackoverflow": "Stack Overflow",
    "medium": "Medium",
    "devto": "Dev.to",
    "quora": "Quora",
    "substack": "Substack",
    "bluesky": "Bluesky",
    "mastodon": "Mastodon",
    "telegram": "Telegram",
    "threads": "Threads",
    "youtube": "YouTube",
    "github": "GitHub",
    "gitlab": "GitLab",
}