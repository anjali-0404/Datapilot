// Real collection engine: scores the curated corpus against the extracted
// intent, then validates + deduplicates with fully deterministic logic.
// Every record returned here comes from CORPUS (real org, real website URL).
import type { ExtractedIntent, SourceRecord } from "@/types";
import { CORPUS, type CorpusOrg } from "@/lib/corpus";

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
  const result = scored.filter((s) => s.score > 0).slice(0, 18);
  if (result.length < 6) {
    for (const s of scored) {
      if (result.includes(s)) continue;
      result.push(s);
      if (result.length >= 6) break;
    }
  }
  return result;
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
// Calibrated so top-ranked matches land ~0.8-0.9 and weak matches ~0.6-0.7,
// giving the UI's confidence badges real spread instead of all-green.
export function recordConfidence(score: number, fieldsFilled: number, fieldsTotal: number): number {
  const completeness = fieldsTotal > 0 ? fieldsFilled / fieldsTotal : 0.5;
  const signal = Math.min(1, score / 14);
  const raw = 0.58 + 0.3 * signal + 0.08 * completeness;
  return Math.round(Math.min(0.96, Math.max(0.55, raw)) * 100) / 100;
}
