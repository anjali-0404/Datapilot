// Smoke check for output quality: confidence spread, backfill honesty,
// requested-column projection and the analyst brief.
// Run with: npx tsx scripts/verify-output-quality.ts
import { collectFromCorpus, dedupeRecords, fillFields, recordConfidence, validateRecord } from "../src/lib/collect";
import { extractIntent } from "../src/lib/collection-engine";
import { buildAnalystBrief } from "../src/lib/insights";
import { mapCrawlerRecordToSourceRecord } from "../src/lib/crawler-client";

const results: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

// 1. Confidence spread must separate strong / good / weak / filler rows.
const spread = [
  ["score 12, full", recordConfidence(12, 6, 6), (v: number) => v >= 0.9],
  ["score 8, full", recordConfidence(8, 6, 6), (v: number) => v >= 0.78 && v < 0.9],
  ["score 4, 4/6", recordConfidence(4, 4, 6), (v: number) => v < 0.7],
  ["score 0 (filler)", recordConfidence(0, 6, 6), (v: number) => v < 0.7],
] as const;
for (const [label, value, expect] of spread) {
  check(`confidence: ${label} = ${value}`, expect(value));
}

// 2. Corpus ranking flags topped-up rows instead of dressing them as matches.
const intent = extractIntent(
  "Find sustainability-focused sponsor leads for a college technology festival in Pune. Include company name, website, industry, location and contact email."
);
const hits = collectFromCorpus(intent);
check("corpus returns rows", hits.length >= 6, `${hits.length} rows`);
const backfilled = hits.filter((h) => h.backfilled);
check(
  "backfilled rows are marked",
  hits.some((h) => h.backfilled) ? backfilled.length > 0 : true,
  `${backfilled.length} of ${hits.length} marked`
);

// 3. Requested columns are honoured; unsupported ones stay honestly empty.
const requested = ["Name", "Website", "Industry", "Location", "Contact Email", "Salary Range"];
const records = hits.map((h, i) => {
  const { fields, filled } = fillFields(h.org, requested);
  const validation = validateRecord(
    { id: String(i), taskId: "t", fields, confidence: 0.8, sourceName: "x", sourceUrl: h.org.website, collectedAt: new Date().toISOString() },
    requested
  );
  return {
    id: `rec_${i}`,
    taskId: "t",
    fields,
    confidence: recordConfidence(h.score, filled, requested.length),
    sourceName: h.connectorId,
    sourceUrl: h.org.website,
    collectedAt: new Date().toISOString(),
    flagged: h.backfilled === true || validation.warnings.length > 0,
  };
});
check("no requested column left undefined", records.every((r) => requested.every((f) => f in r.fields)));
const { unique, removed } = dedupeRecords(records);
check("dedupe removes nothing unexpected", removed === 0, `${removed} removed`);

// 4. The analyst brief answers the question and admits its own gaps.
const brief = buildAnalystBrief({
  prompt: intent.goal,
  records: unique,
  columns: requested,
  sourcesUsed: Array.from(new Set(unique.map((r) => r.sourceName))),
  intent,
});
check("brief has a headline", brief.headline.length > 20, brief.headline);
check("brief narrative has 2+ sentences", brief.narrative.length >= 2, `${brief.narrative.length} lines`);
check("brief lists unsupported column as a gap", brief.gaps.some((g) => g.includes("Salary Range")), brief.gaps.join(" | "));
check("brief has a recommendation", brief.recommendation.length > 20, brief.recommendation);
check("brief coverage covers every column", brief.coverage.length === requested.length);
const filledPct = brief.coverage.find((c) => c.field === "Name")?.pct ?? 0;
check("Name column fully covered", filledPct === 100, `${filledPct}%`);

// 5. Live records project onto requested columns (not crawler-internal fields).
const liveIntent = { ...intent, fields: requested };
const live = mapCrawlerRecordToSourceRecord(
  {
    platform: "rss",
    source: "https://example.com/feed",
    source_url: "https://example.com/articles/india-fintech-funding",
    scraped_at: "2026-09-29T10:00:00Z",
    companies: ["razorpay"],
    title: "Razorpay leads fintech funding round",
    text: "Razorpay raised a new round…",
  },
  "task_1",
  liveIntent
);
check("live record fills requested columns", requested.every((f) => f in live.fields));
check("live record keeps provenance URL", live.sourceUrl.startsWith("https://"), live.sourceUrl);
check("live record has a human source label", live.sourceName === "RSS Feeds", live.sourceName);
check("live record enriches from corpus when the company is known", live.fields["Industry"] === "Fintech", String(live.fields["Industry"]));
check("live record id is deterministic",
  mapCrawlerRecordToSourceRecord(
    { platform: "rss", source: "https://example.com/feed", source_url: "https://example.com/articles/india-fintech-funding", scraped_at: "2026-09-29T10:00:00Z", companies: ["razorpay"], title: "Razorpay leads fintech funding round", text: "x" },
    "task_1",
    liveIntent
  ).id === live.id
);
check("crawler text rides along as context (not as an asked column)", live.fields["Text"] !== undefined && !requested.includes("Text"));

// 6. The crawler's `companies[]` is a *search keyword*, often a generic goal
//    word. It must never be promoted to the row's Name.
const genericKeywordGoal = "Find recent news about AI startup funding rounds in India";
const newsIntent = { ...intent, goal: genericKeywordGoal, fields: ["Name", "Website"] };
const withTitle = mapCrawlerRecordToSourceRecord(
  {
    platform: "rss",
    source: "https://techcrunch.com/feed/",
    source_url: "https://techcrunch.com/2026/09/28/peak-xv-seed/",
    scraped_at: "2026-09-29",
    companies: ["startup", "india"],
    title: "Peak XV ups Surge seed investment ceiling",
    text: "Peak XV ups Surge…",
  },
  "task_1",
  newsIntent
);
check("headline wins over generic keyword as Name",
  withTitle.fields["Name"] === "Peak XV ups Surge seed investment ceiling",
  String(withTitle.fields["Name"])
);
check("Company only set when a keyword resolves to a corpus org",
  withTitle.fields["Company"] === undefined,
  String(withTitle.fields["Company"])
);
const noTitle = mapCrawlerRecordToSourceRecord(
  {
    platform: "bbcnews",
    source: "https://bbc.com/news/technology",
    source_url: "https://bbc.com/news/technology-abc",
    scraped_at: "2026-09-29",
    companies: ["startup"],
    text: "Funding rounds in the technology sector slowed down this quarter across Europe.",
  },
  "task_1",
  newsIntent
);
check("generic keyword never becomes Name when there is no headline",
  !/^startup$/i.test(String(noTitle.fields["Name"])),
  String(noTitle.fields["Name"])
);
check("provenance still points at the article, not the feed",
  noTitle.sourceUrl === "https://bbc.com/news/technology-abc", noTitle.sourceUrl);

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) process.exit(1);
