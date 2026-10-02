// Analyst Brief: the narrative answer layer on top of the raw table.
//
// Everything here is a pure function over the records that were actually
// delivered — no LLM, no randomness — so the same dataset always yields the
// same brief and every sentence can be traced back to rows in the table.
// It exists because a table alone makes the reader do the synthesis: this
// module does the synthesis and states its own gaps out loud.
import type { ExtractedIntent, SourceRecord } from "@/types";
import { COLLECTABLE_FIELDS } from "@/lib/collect";

export type BriefTone = "good" | "info" | "warn";

export interface BriefStat {
  label: string;
  value: string;
}

export interface BriefTopMatch {
  name: string;
  url: string;
  confidence: number;
  reason: string;
}

export interface BriefCoverage {
  field: string;
  filled: number;
  total: number;
  pct: number;
}

export interface BriefFinding {
  tone: BriefTone;
  text: string;
}

export interface AnalystBrief {
  headline: string;
  narrative: string[];
  stats: BriefStat[];
  topMatches: BriefTopMatch[];
  coverage: BriefCoverage[];
  findings: BriefFinding[];
  gaps: string[];
  recommendation: string;
}

export interface BriefInput {
  prompt: string;
  records: SourceRecord[];
  columns: string[];
  sourcesUsed: string[];
  intent?: ExtractedIntent | null;
}

const isFilled = (v: unknown): boolean => {
  const s = String(v ?? "").trim();
  return s !== "" && s !== "—" && s !== "null" && s !== "undefined";
};

const pct = (part: number, total: number): number =>
  total > 0 ? Math.round((part / total) * 100) : 0;

function displayName(rec: SourceRecord): string {
  const name = rec.fields["Name"] ?? rec.fields["Company"];
  return isFilled(name) ? String(name) : "Unnamed record";
}

function matchReason(rec: SourceRecord): string {
  const parts: string[] = [];
  const industry = rec.fields["Industry"];
  const location = rec.fields["Location"];
  if (isFilled(industry)) parts.push(String(industry));
  if (isFilled(location)) parts.push(String(location));
  if (parts.length === 0) parts.push(rec.sourceName);
  return parts.join(" · ");
}

function headlineFor(input: BriefInput, count: number): string {
  const { intent, sourcesUsed, prompt } = input;
  const where = intent?.location ? ` in ${intent.location}` : "";
  const what = intent?.entityType && intent.entityType !== "Organization"
    ? intent.entityType.toLowerCase()
    : subjectFromPrompt(prompt);

  if (count === 0) {
    return `Nothing traceable turned up for ${what}${where}`;
  }
  const layers = sourcesUsed.length;
  return `Found ${count} traceable ${what} record${count === 1 ? "" : "s"}${where} across ${layers} source layer${layers === 1 ? "" : "s"}`;
}

/** Falls back to a short noun phrase lifted from the prompt when intent is absent. */
function subjectFromPrompt(prompt: string): string {
  const cleaned = prompt
    .replace(/^(please\s+)?(find|get|collect|list|show|gather|give me|search for|track down)\s+/i, "")
    .replace(/[.?!"]+$/g, "")
    .trim();
  const words = cleaned.split(/\s+/).slice(0, 5).join(" ");
  return words.toLowerCase() || "requested";
}

/**
 * Build the brief. Deterministic: same inputs, same output, in the same order.
 */
export function buildAnalystBrief(input: BriefInput): AnalystBrief {
  const { records, columns, sourcesUsed, intent } = input;
  const total = records.length;

  // -- coverage per requested column -----------------------------------------
  const coverage: BriefCoverage[] = columns.map((field) => {
    const filled = records.filter((r) => isFilled(r.fields[field])).length;
    return { field, filled, total, pct: pct(filled, total) };
  });

  const ranked = [...records].sort(
    (a, b) => b.confidence - a.confidence || displayName(a).localeCompare(displayName(b))
  );
  const strong = records.filter((r) => r.confidence >= 0.85).length;
  const weak = records.filter((r) => r.confidence < 0.7).length;
  const flagged = records.filter((r) => r.flagged).length;
  const avgConfidence = total
    ? Math.round((records.reduce((s, r) => s + r.confidence, 0) / total) * 100)
    : 0;

  const unsupported = columns.filter((c) => !COLLECTABLE_FIELDS.has(c));
  const thin = coverage.filter((c) => c.pct < 60 && !unsupported.includes(c.field));
  const best = coverage.filter((c) => !unsupported.includes(c.field)).sort((a, b) => b.pct - a.pct)[0];
  const worst = coverage.filter((c) => !unsupported.includes(c.field) && c.pct > 0).sort((a, b) => a.pct - b.pct)[0];

  // -- source concentration ---------------------------------------------------
  const bySource = new Map<string, number>();
  for (const r of records) bySource.set(r.sourceName, (bySource.get(r.sourceName) ?? 0) + 1);
  const topSource = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0];
  const concentration = topSource ? pct(topSource[1], total) : 0;

  // -- headline + narrative ---------------------------------------------------
  const headline = headlineFor(input, total);
  const topNames = ranked.slice(0, 3).map(displayName);
  const narrative: string[] = [];

  if (total > 0) {
    narrative.push(
      `${strong} of ${total} rows rank as strong matches (85% confidence or higher)` +
        `${weak > 0 ? `, while ${weak} sit below 70% and should be checked before use` : ""}.`
    );
    narrative.push(
      `The strongest rows are ${listWords(topNames)} — each one links back to the page it came from.`
    );
    if (best && worst && best.field !== worst.field) {
      narrative.push(
        `${best.field} is filled in ${best.pct}% of rows; ${worst.field} is the thinnest at ${worst.pct}%.` +
          (flagged > 0 ? ` ${flagged} row${flagged === 1 ? " is" : "s are"} flagged for review.` : "")
      );
    } else if (best) {
      narrative.push(
        `${best.field} is filled in ${best.pct}% of rows.` +
          (flagged > 0 ? ` ${flagged} row${flagged === 1 ? " is" : "s are"} flagged for review.` : "")
      );
    }
  } else {
    narrative.push(
      `The pipeline ran end to end but no row could be traced to a source URL, so nothing was published.`
    );
  }

  // -- findings ---------------------------------------------------------------
  const findings: BriefFinding[] = [];
  if (total > 0) {
    findings.push({
      tone: "good",
      text: `Every published row resolves to a live source URL — open any row to verify it yourself.`,
    });
    if (sourcesUsed.length >= 3) {
      findings.push({
        tone: "good",
        text: `${sourcesUsed.length} source layers contributed (${listWords(sourcesUsed)}), so the answer is not resting on a single feed.`,
      });
    } else if (topSource) {
      findings.push({
        tone: concentration >= 60 ? "warn" : "info",
        text: `${topSource[0]} supplied ${concentration}% of rows — corroborate anything critical with a second layer.`,
      });
    }
    if (intent) {
      findings.push({
        tone: "info",
        text: `Intent parsed at ${Math.round(intent.confidence * 100)}% confidence into ${intent.fields.length} requested column${intent.fields.length === 1 ? "" : "s"}${
          intent.constraints.length > 0 ? `, with ${intent.constraints.length} filter${intent.constraints.length === 1 ? "" : "s"} applied` : ""
        }.`,
      });
    }
    if (flagged === 0 && weak === 0) {
      findings.push({ tone: "good", text: `No rows were flagged — the table passed validation clean.` });
    }
  }

  // -- gaps: what this dataset does NOT answer --------------------------------
  const gaps: string[] = [];
  for (const f of unsupported) {
    gaps.push(`${f} is not in this knowledge base — that column ships empty rather than guessed.`);
  }
  for (const c of thin) {
    gaps.push(`${c.field} is missing from ${100 - c.pct}% of rows.`);
  }
  if (flagged > 0) {
    gaps.push(`${flagged} row${flagged === 1 ? " is" : "s are"} flagged (validation warning or weak match).`);
  }
  if (total > 0 && weak > 0) {
    gaps.push(`${weak} row${weak === 1 ? "" : "s"} below 70% confidence.`);
  }
  if (total === 0) {
    gaps.push("Zero rows delivered — nothing to analyze yet.");
  }

  // -- recommendation ---------------------------------------------------------
  // A row can be both high-confidence and flagged (e.g. a validation warning),
  // so the recommendation splits rows into two disjoint groups rather than
  // counting such a row as both "ready" and "needs review".
  const ready = records.filter((r) => r.confidence >= 0.85 && !r.flagged).length;
  const review = records.filter((r) => r.flagged || r.confidence < 0.7).length;
  const recommendation = buildRecommendation({
    total,
    ready,
    review,
    unsupported,
    thin,
    intent,
  });

  const stats: BriefStat[] = [
    { label: "Records delivered", value: String(total) },
    { label: "Average confidence", value: `${avgConfidence}%` },
    { label: "Source layers", value: String(sourcesUsed.length) },
    { label: "Flagged for review", value: String(flagged) },
  ];

  const topMatches: BriefTopMatch[] = ranked.slice(0, 5).map((r) => ({
    name: displayName(r),
    url: r.sourceUrl,
    confidence: r.confidence,
    reason: matchReason(r),
  }));

  return { headline, narrative, stats, topMatches, coverage, findings, gaps, recommendation };
}

function buildRecommendation(args: {
  total: number;
  ready: number;
  review: number;
  unsupported: string[];
  thin: BriefCoverage[];
  intent?: ExtractedIntent | null;
}): string {
  const { total, ready, review, unsupported, thin, intent } = args;

  if (total === 0) {
    return intent?.location
      ? `Turn on Live Mode for this question — the curated corpus has nothing in ${intent.location} for this goal, so the live web is the next place to look.`
      : "Turn on Live Mode and re-run — the live crawlers will search outside the curated corpus.";
  }

  const steps: string[] = [];
  if (ready > 0) {
    steps.push(`start with the ${ready} strong match${ready === 1 ? "" : "es"} (85%+, unflagged) — they are complete and source-linked`);
  }
  if (review > 0) {
    steps.push(`open the source link on the ${review} flagged or weaker row${review === 1 ? "" : "s"} before acting on them`);
  }
  if (unsupported.length > 0) {
    steps.push(`pull ${listWords(unsupported)} from the source sites directly — this knowledge base does not carry them`);
  } else if (thin.length > 0) {
    steps.push(`fill ${listWords(thin.map((t) => t.field))} from the linked pages, since coverage is thin there`);
  }

  if (steps.length === 0) {
    return "The table is complete and source-linked — export it as CSV or JSON and it is ready to use.";
  }
  return `${capitalize(steps.join("; then "))}.`;
}

function listWords(items: string[]): string {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
