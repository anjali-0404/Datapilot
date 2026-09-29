// Crawler Service Client - bridges DataPilot to the Python crawler microservice
import type { ExtractedIntent, CrawlerRecord, SourceRecord } from "@/types";
import { CORPUS } from "@/lib/corpus";

const CRAWLER_SERVICE_URL = process.env.CRAWLER_SERVICE_URL || "http://localhost:8001";

interface CrawlRequest {
  intent: ExtractedIntent;
  platforms?: string[];
  max_records_per_platform?: number;
  enabled_categories?: ("news" | "reviews" | "social" | "dev")[];
}

interface CrawlResponse {
  records: CrawlerRecord[];
  platform_stats: Record<string, number>;
  errors: Record<string, string>;
  total_records: number;
  crawl_duration_ms: number;
}

interface CrawlJobResponse {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  current_platform?: string;
  records_collected: number;
  error?: string;
  started_at: string;
  completed_at?: string;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 300000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function startLiveCrawl(request: CrawlRequest): Promise<CrawlResponse> {
  const response = await fetchWithTimeout(`${CRAWLER_SERVICE_URL}/crawl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  }, 300000); // 5 min timeout for full crawl

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Crawler service error: ${response.status} ${error}`);
  }

  return response.json();
}

export async function startAsyncCrawl(request: CrawlRequest): Promise<CrawlJobResponse> {
  const response = await fetch(`${CRAWLER_SERVICE_URL}/crawl/async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Crawler service error: ${response.status} ${error}`);
  }

  return response.json();
}

export async function pollCrawlJob(jobId: string): Promise<CrawlJobResponse> {
  const response = await fetch(`${CRAWLER_SERVICE_URL}/crawl/async/${jobId}`);
  if (!response.ok) {
    throw new Error(`Failed to poll crawl job: ${response.status}`);
  }
  return response.json();
}

export async function getAvailablePlatforms(): Promise<Array<{ id: string; name: string; category: string }>> {
  const response = await fetch(`${CRAWLER_SERVICE_URL}/platforms`);
  if (!response.ok) {
    return [];
  }
  return response.json();
}

/** Human labels for the platform ids the crawler service returns. */
export const PLATFORM_NAMES: Record<string, string> = {
  rss: "RSS Feeds",
  bbcnews: "BBC News",
  thehackernews: "The Hacker News",
  reddit: "Reddit",
  hackernews: "Hacker News",
  trustpilot: "Trustpilot",
  googleplay: "Google Play",
  appstore: "App Store",
  github: "GitHub",
};

const clean = (v: unknown): string => String(v ?? "").trim();

function slugId(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
}

/**
 * Resolve a live-discovered company against the curated corpus so a row found
 * on the open web can still carry its website / industry / location / contact
 * details. Case-insensitive, whole-name match — never a fuzzy guess, because a
 * wrong Website link is worse than an empty cell.
 */
function corpusLookup(company: string) {
  const needle = clean(company).toLowerCase();
  if (!needle) return undefined;
  return CORPUS.find((o) => o.name.toLowerCase() === needle || o.name.toLowerCase() === needle.replace(/\b(limited|ltd|pvt|inc|corp)\b\.?/g, "").trim());
}

/**
 * The crawler's `companies[]` holds the *search keyword* that matched a page —
 * frequently a generic goal word ("startup", "about"), never an entity name.
 * Only a keyword that appears capitalized in the original question counts as a
 * proper noun, and we keep the question's own casing for it.
 */
function properNounIn(keyword: string, goal: string): string {
  if (!keyword || !goal) return "";
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = new RegExp(`\\b${escaped}\\b`, "i").exec(goal);
  if (!found || !/^[A-Z]/.test(found[0])) return "";
  return found[0];
}

function stripEntities(s: string): string {
  return s.replace(/&#\d+;/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

/**
 * Map one crawler record onto exactly the columns the question asked for.
 *
 * Two rules make this trustworthy:
 *  1. A requested column is only filled from evidence (structured metadata or a
 *     verified corpus record for the same company). Never from a guess.
 *  2. The crawled page itself (title/text) rides along as `Title`/`Text` so the
 *     detail view and full-text search keep the raw context, without ever being
 *     presented as a value for a column the user asked for.
 */
export function mapCrawlerRecordToSourceRecord(
  crawlerRecord: CrawlerRecord,
  taskId: string,
  intent: ExtractedIntent
): SourceRecord {
  const requested = intent.fields.length > 0 ? intent.fields : ["Name", "Website"];
  const meta = (crawlerRecord.raw_metadata ?? {}) as Record<string, unknown>;
  const matched = crawlerRecord.companies.map(clean).filter(Boolean);

  // Proper nouns actually named in the question, in the order they matched.
  const entity = matched.map((c) => properNounIn(c, intent.goal)).find(Boolean) ?? "";

  // Name priority: the page's own headline (specific + checkable), else a
  // snippet of the crawled text, else a proper noun from the question — never a
  // generic keyword like "startup", and never the placeholder "Unknown".
  const headline = clean(crawlerRecord.title);
  const snippet = stripEntities(crawlerRecord.text ?? "").slice(0, 80);
  const nameValue = headline || snippet || entity || clean(crawlerRecord.source);

  // Enrich from the curated corpus when any matched keyword resolves to a known org.
  // A goal keyword that did not resolve is a *topic*, not the record's company —
  // it never gets promoted to the Company column.
  const corpus = matched.map(corpusLookup).find(Boolean);

  const evidence: Record<string, string | undefined> = {
    Name: nameValue || undefined,
    Company: corpus?.name || undefined,
    Website: clean(meta.website) || corpus?.website,
    Industry: clean(meta.industry) || corpus?.industry,
    Location: clean(meta.location) || corpus?.location,
    "Contact Email": clean(meta.email) || corpus?.contactEmail,
    Phone: clean(meta.phone) || corpus?.phone,
  };

  const fields: Record<string, string | number> = {};
  let filled = 0;
  for (const key of requested) {
    const direct = (evidence[key] ?? clean(meta[key])) || undefined;
    if (direct && direct !== "—") {
      fields[key] = direct;
      filled++;
    } else {
      fields[key] = "—";
    }
  }

  // Raw crawl context, kept out of the requested columns.
  if (!requested.includes("Title") && headline) fields["Title"] = headline;
  if (!requested.includes("Text") && crawlerRecord.text) {
    fields["Text"] = crawlerRecord.text.length > 400 ? `${crawlerRecord.text.slice(0, 400)}…` : crawlerRecord.text;
  }

  const completeness = requested.length > 0 ? filled / requested.length : 0.5;
  const hint = Math.min(1, Math.max(0, crawlerRecord.confidence_hint ?? 0.65));
  const pageUrl = clean(crawlerRecord.source_url) || clean(crawlerRecord.source);
  let confidence = 0.45 + 0.35 * hint + 0.2 * completeness;
  if (/^https?:\/\//.test(pageUrl)) confidence += 0.05;
  // A row that answered none of the asked columns must never look usable.
  if (requested.length > 0 && filled === 0) confidence = Math.min(confidence, 0.55);
  confidence = Math.round(Math.min(0.95, Math.max(0.5, confidence)) * 100) / 100;

  // Deterministic id: same record on every rerun (no timestamps, no randomness),
  // so re-running a task reproduces identical ids instead of churning them.
  const nameKey = slugId(String(fields["Name"] ?? "")) || "unnamed";
  const urlKey = slugId(pageUrl) || slugId(crawlerRecord.platform);

  return {
    id: `live_${slugId(crawlerRecord.platform)}_${nameKey}_${urlKey}`.slice(0, 120),
    taskId,
    fields,
    confidence,
    sourceName: PLATFORM_NAMES[crawlerRecord.platform] ?? crawlerRecord.platform,
    sourceUrl: pageUrl,
    collectedAt: crawlerRecord.scraped_at,
    flagged: confidence < 0.7,
  };
}

// Platform categories for UI
export const PLATFORM_CATEGORIES = {
  news: ["rss", "bbcnews", "thehackernews"],
  reviews: ["trustpilot", "googleplay", "appstore"],
  social: ["reddit", "hackernews"],
  dev: ["github"],
} as const;

export type PlatformCategory = keyof typeof PLATFORM_CATEGORIES;

export function getPlatformsForCategories(categories: PlatformCategory[]): string[] {
  return categories.flatMap(c => PLATFORM_CATEGORIES[c]);
}