// Real collection engine: scores the curated corpus against the extracted
// intent, then validates + deduplicates with fully deterministic logic.
// Every record returned here comes from CORPUS (real org, real website URL).
// Also supports live crawling via external crawler microservice.
import type { ExtractedIntent, SourceRecord } from "@/types";
import { CORPUS, type CorpusOrg } from "@/lib/corpus";
import { CONNECTORS } from "@/lib/collection-engine";
import {
  startLiveCrawl,
  mapCrawlerRecordToSourceRecord,
  getPlatformsForCategories,
  type PlatformCategory,
} from "@/lib/crawler-client";

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
}

const STOP = new Set(["the", "and", "for", "with", "from", "that", "this", "are", "find", "include", "including", "company", "data", "need", "needs", "information", "collect", "focused", "based", "openings", "open", "early", "stage", "list", "top", "best", "new"]);

function scoreOrg(org: CorpusOrg, intent: ExtractedIntent, keywords: Set<string>): number {
  let score = 0;
  const hay = `${org.name} ${org.industry} ${org.tags.join(" ")}`.toLowerCase();
  for (const kw of keywords) {
    if (hay.includes(kw)) score += 2;
  }
  const goal = intent.goal.toLowerCase();
  for (const tag of org.tags) {
    if (goal.includes(tag)) score += 3;
  }
  if (intent.location && org.location.toLowerCase() === intent.location.toLowerCase()) score += 4;
  else if (intent.location && org.location.toLowerCase().includes(intent.location.toLowerCase().slice(0, 4))) score += 1;
  // Domain affinity: entity-type words matching industry
  if (intent.entityType === "Job Opening" && /software|technology|fintech/i.test(org.industry)) score += 1;
  if (intent.entityType === "Sponsor Lead" && org.tags.includes("sponsor")) score += 2;
  if (intent.entityType === "Investor" && /fintech|finance/i.test(org.industry)) score += 1;
  return score;
}

export interface CorpusHit {
  org: CorpusOrg;
  score: number;
  connectorId: string;
  /**
   * True when this row was pulled in purely to keep the table from being
   * near-empty (score 0 — no relevance signal). Callers surface it as
   * "flagged" so a filler row is never dressed up as a match.
   */
  backfilled?: boolean;
}

/**
 * Rank the curated corpus against the extracted intent.
 * `enabledLayers` limits the search to the source layers the user has switched
 * on (Sources page); when it is empty/undefined every layer is searched.
 */
export function collectFromCorpus(intent: ExtractedIntent, enabledLayers?: string[]): CorpusHit[] {
  const allowed = enabledLayers && enabledLayers.length > 0 ? new Set(enabledLayers) : null;
  const keywords = new Set(tokenize(intent.goal).filter((w) => !STOP.has(w)));
  const scored: CorpusHit[] = CORPUS.filter((org) => !allowed || allowed.has(org.layer)).map(
    (org) => ({ org, score: scoreOrg(org, intent, keywords), connectorId: org.layer })
  );
  scored.sort((a, b) => b.score - a.score || a.org.name.localeCompare(b.org.name));

  // Everything with a signal, capped at 18; if that yields fewer than 6 rows the
  // best remaining orgs top up the table so a dataset is never near-empty.
  // Topped-up rows are explicitly marked `backfilled` — they carry no relevance
  // signal and are reported as such instead of passing as real matches.
  const result = scored.filter((s) => s.score > 0).slice(0, 18);
  if (result.length < 6) {
    for (const s of scored) {
      if (result.includes(s)) continue;
      result.push({ ...s, backfilled: true });
      if (result.length >= 6) break;
    }
  }
  return result;
}

/**
 * Project a corpus org onto exactly the columns the question asked for.
 * Returns the filled values plus how many were actually populated, so
 * confidence reflects real completeness rather than an assumed best case.
 */
export function fillFields(
  org: CorpusOrg,
  requestedFields: string[]
): { fields: Record<string, string | number>; filled: number } {
  const fields: Record<string, string | number> = {};
  let filled = 0;
  for (const f of requestedFields) {
    let v: string | number | undefined;
    switch (f) {
      case "Name": v = org.name; break;
      case "Company": v = org.name; break;
      case "Website": v = org.website; break;
      case "Industry": v = org.industry; break;
      case "Location": v = org.location; break;
      case "Contact Email": v = org.contactEmail; break;
      case "Phone": v = org.phone; break;
      default: v = undefined;
    }
    if (v !== undefined && String(v).trim() !== "") {
      fields[f] = v;
      filled++;
    } else {
      fields[f] = "—";
    }
  }
  return { fields, filled };
}

/**
 * Which source layers this question will actually be answered from: the layers
 * of the organizations that pass the relevance filter, in ranking order. This is
 * what the Plan stage reports as "sources being searched", so the plan and the
 * result can never disagree.
 */
export function planSourcesForIntent(intent: ExtractedIntent, enabledLayers?: string[], max = 5): string[] {
  const layers: string[] = [];
  for (const hit of collectFromCorpus(intent, enabledLayers)) {
    if (!layers.includes(hit.connectorId)) layers.push(hit.connectorId);
    if (layers.length >= max) break;
  }
  return layers;
}

// -- Validate: real checks -------------------------------------------------
export interface ValidationResult {
  /** false only for records that cannot be published at all (no name / no source). */
  valid: boolean;
  /** Field gaps that are worth surfacing but do not disqualify the record. */
  warnings: string[];
  /** Hard failures — the record is dropped. */
  reasons: string[];
}

/**
 * The columns this knowledge base can actually fill. Anything else the user asks
 * for (salary bands, role titles, …) is delivered as an empty column and reported
 * once by the Validate stage, rather than flagged on every row.
 */
export const COLLECTABLE_FIELDS = new Set([
  "Name",
  "Company",
  "Website",
  "Industry",
  "Location",
  "Contact Email",
  "Phone",
]);

export function unsupportedFields(requestedFields: string[]): string[] {
  return requestedFields.filter((f) => !COLLECTABLE_FIELDS.has(f));
}

/**
 * Validate against the fields the question actually asked for. A record is only
 * dropped when it has no name or cannot be traced to a source URL; anything else
 * (a column the sources could not fill) is reported as a warning so the row still
 * reaches the dataset, flagged for review.
 */
export function validateRecord(rec: SourceRecord, requestedFields?: string[]): ValidationResult {
  const warnings: string[] = [];
  const reasons: string[] = [];
  const f = rec.fields;
  const asked = requestedFields && requestedFields.length > 0 ? new Set(requestedFields) : null;
  const askedFor = (key: string) => !asked || asked.has(key);

  const name = String(f["Name"] ?? f["Company"] ?? "").trim();
  if (name.length < 2) reasons.push("missing name");

  // Provenance is never optional: a record we cannot trace has no place here.
  const url = String(f["Website"] ?? rec.sourceUrl ?? "");
  if (!/^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(url)) reasons.push("missing or invalid source URL");
  else if (askedFor("Website") && !f["Website"]) warnings.push("website not in source layer");

  const email = String(f["Contact Email"] ?? "");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) warnings.push("bad email format");

  // Only the columns this knowledge base can actually fill are held against a row.
  for (const field of asked ?? []) {
    if (!COLLECTABLE_FIELDS.has(field)) continue;
    const v = String(f[field] ?? "").trim();
    if (!v || v === "—") warnings.push(`${field} not in source layer`);
  }

  return { valid: reasons.length === 0, warnings: Array.from(new Set(warnings)), reasons };
}

// -- Deduplicate: normalized key, deterministic --------------------------------
export function dedupeKey(rec: SourceRecord): string {
  const name = String(rec.fields["Name"] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const domain = String(rec.fields["Website"] ?? rec.sourceUrl).toLowerCase().replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  return `${name}|${domain}`;
}

export function dedupeRecords(records: SourceRecord[]): { unique: SourceRecord[]; removed: number } {
  const seen = new Set<string>();
  const unique: SourceRecord[] = [];
  for (const r of records) {
    const k = dedupeKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(r);
  }
  return { unique, removed: records.length - unique.length };
}

// -- Confidence: deterministic, from evidence -----------------------------------
// Evidence = relevance signal (how hard the org matched the question) plus
// field completeness. Calibrated across the full 0.50–0.98 range so the UI's
// badges and the analytics histogram actually separate strong from weak rows:
//   score 12, all columns filled  -> ~0.98  (strong match)
//   score 8,  all columns filled  -> ~0.84  (good match)
//   score 4,  most columns filled -> ~0.67  (weak match)
//   score 0 (backfilled filler)   -> ~0.56  (never advertised as a match)
export function recordConfidence(score: number, fieldsFilled: number, fieldsTotal: number): number {
  const completeness = fieldsTotal > 0 ? fieldsFilled / fieldsTotal : 0.5;
  const signal = Math.min(1, Math.max(0, score / 12));
  const raw = 0.42 + 0.42 * signal + 0.14 * completeness;
  // A row with no relevance signal cannot claim "good match" however complete
  // its columns are — cap it below the 0.70 "weak match" threshold.
  const capped = score <= 0 ? Math.min(raw, 0.58) : raw;
  return Math.round(Math.min(0.98, Math.max(0.5, capped)) * 100) / 100;
}

// -- Live Crawling Integration ----------------------------------------------------
// Calls external Python microservice for real-time web crawling

export interface LiveCrawlOptions {
  intent: ExtractedIntent;
  enabledCategories?: PlatformCategory[];
  maxRecordsPerPlatform?: number;
  specificPlatforms?: string[];
  taskId?: string;
}

export interface LiveCrawlResult {
  records: SourceRecord[];
  platformStats: Record<string, number>;
  errors: Record<string, string>;
  totalRecords: number;
  durationMs: number;
}

/**
 * Execute live crawl via crawler microservice and convert to SourceRecords.
 * Returns corpus hits + live records, merged and deduplicated.
 */
export async function collectLive(
  options: LiveCrawlOptions
): Promise<LiveCrawlResult> {
  const { intent, enabledCategories, maxRecordsPerPlatform = 50, specificPlatforms, taskId = "" } = options;

  let platforms = specificPlatforms;
  if (!platforms && enabledCategories) {
    platforms = getPlatformsForCategories(enabledCategories);
  }

  const crawlRequest = {
    intent,
    platforms,
    max_records_per_platform: maxRecordsPerPlatform,
    enabled_categories: enabledCategories,
  };

  const response = await startLiveCrawl(crawlRequest);

  // Convert crawler records to SourceRecords, projected onto the requested columns
  const sourceRecords: SourceRecord[] = response.records.map((cr) =>
    mapCrawlerRecordToSourceRecord(cr, taskId, intent)
  );

  return {
    records: sourceRecords,
    platformStats: response.platform_stats,
    errors: response.errors,
    totalRecords: response.total_records,
    durationMs: response.crawl_duration_ms,
  };
}

/**
 * Hybrid collection: corpus + live crawl, merged and deduplicated.
 * This is the main entry point for the Collect stage when live mode is enabled.
 */
export async function collectHybrid(
  intent: ExtractedIntent,
  options: {
    enabledLayers?: string[];           // corpus layers
    enabledCategories?: PlatformCategory[]; // live categories
    maxCorpusResults?: number;
    maxLivePerPlatform?: number;
    liveMode?: boolean;
    taskId?: string;
  } = {}
): Promise<{
  corpus: CorpusHit[];
  live: SourceRecord[];
  combined: SourceRecord[];
  platformStats: Record<string, number>;
  errors: Record<string, string>;
}> {
  const {
    enabledLayers,
    enabledCategories,
    maxCorpusResults = 18,
    maxLivePerPlatform = 50,
    liveMode = false,
    taskId = "",
  } = options;

  // Always get corpus results (deterministic fallback)
  const corpusHits = collectFromCorpus(intent, enabledLayers).slice(0, maxCorpusResults);

  // Project corpus hits onto the columns this question actually asked for —
  // the same mapping the corpus-only path uses, so hybrid and non-hybrid
  // datasets are shaped identically. (This previously hardcoded 7 columns,
  // silently dropping any column the prompt requested.)
  const connectorNames = new Map(CONNECTORS.map((c) => [c.id, c.name]));
  const corpusRecords: SourceRecord[] = corpusHits.map((hit, i) => {
    const { fields, filled } = fillFields(hit.org, intent.fields);
    return {
      id: `corpus_${i}_${slugify(hit.org.name)}`,
      taskId,
      fields,
      confidence: recordConfidence(hit.score, filled, intent.fields.length),
      sourceName: connectorNames.get(hit.connectorId) ?? hit.connectorId,
      sourceUrl: hit.org.website,
      collectedAt: new Date().toISOString(),
      flagged: hit.backfilled === true,
    };
  });

  let liveRecords: SourceRecord[] = [];
  let platformStats: Record<string, number> = {};
  let errors: Record<string, string> = {};

  if (liveMode && enabledCategories && enabledCategories.length > 0) {
    try {
      const liveResult = await collectLive({
        intent,
        enabledCategories,
        maxRecordsPerPlatform: maxLivePerPlatform,
        taskId,
      });
      liveRecords = liveResult.records;
      platformStats = liveResult.platformStats;
      errors = liveResult.errors;
    } catch (err) {
      console.error("[collectHybrid] Live crawl failed:", err);
      errors["live_crawl"] = err instanceof Error ? err.message : "Unknown error";
    }
  }

  // Merge and deduplicate. Corpus rows come first so, when the same company is
  // found both in the corpus and on the open web, the fully-filled corpus row wins.
  const combined = [...corpusRecords, ...liveRecords];
  const { unique } = dedupeRecords(combined);

  return { corpus: corpusHits, live: liveRecords, combined: unique, platformStats, errors };
}

function slugify(s: string): string {
  return s.replace(/\s+/g, "_");
}
