import type { SourceRecord, StageId, ExtractedIntent } from "@/types";
import { CONNECTORS } from "@/lib/collection-engine";
import { PLATFORM_NAMES, type PlatformCategory } from "@/lib/crawler-client";
import {
  collectFromCorpus,
  collectHybrid,
  dedupeRecords,
  fillFields,
  planSourcesForIntent,
  recordConfidence,
  unsupportedFields,
  validateRecord,
  type CorpusHit,
} from "@/lib/collect";
import { buildAnalystBrief } from "@/lib/insights";
import { extractIntentAI } from "@/lib/server/ai";
import * as repo from "@/lib/server/repository";

const STAGE_ORDER: StageId[] = ["interpret", "plan", "collect", "validate", "deduplicate", "deliver"];
const STAGE_DURATIONS: Record<StageId, number> = {
  interpret: 1400,
  plan: 1600,
  collect: 3200,
  validate: 1800,
  deduplicate: 1200,
  deliver: 900,
};

// One Node process backs `next dev` / `next start`, so an in-memory timer
// registry per task is enough to drive live progress.
// A production deployment behind a serverless platform would replace this
// with a real job queue (e.g. a worker consuming a Postgres-backed queue),
// but the persisted state (Task/Stage/Dataset rows) is real either way.
const timers = new Map<string, ReturnType<typeof setTimeout>>();
function setTimer(taskId: string, fn: () => void, ms: number) {
  const existing = timers.get(taskId);
  if (existing) clearTimeout(existing);
  timers.set(taskId, setTimeout(fn, ms));
}

const runState = new Map<
  string,
  {
    raw: number;
    validated: SourceRecord[];
    dropped: number;
    duplicatesRemoved: number;
    connectors: string[];
    liveMode?: boolean;
    enabledCategories?: string[];
  }
>();

export function startPipeline(
  taskId: string,
  prompt: string,
  options: { liveMode?: boolean; enabledCategories?: string[] } = {}
) {
  runState.set(taskId, {
    raw: 0,
    validated: [],
    dropped: 0,
    duplicatesRemoved: 0,
    connectors: [],
    liveMode: options.liveMode,
    enabledCategories: options.enabledCategories,
  });
  repo.setTaskStatus(taskId, "running").catch((e) => console.error("[pipeline] setTaskStatus failed", e));
  runStage(taskId, prompt, 0);
}

export function pausePipeline(taskId: string) {
  const timer = timers.get(taskId);
  if (timer) clearTimeout(timer);
  timers.delete(taskId);
  return repo.setTaskStatus(taskId, "paused");
}

export async function resumePipeline(taskId: string, prompt: string) {
  const existing = timers.get(taskId);
  if (existing) clearTimeout(existing);
  await repo.setTaskStatus(taskId, "running");
  const task = await repo.getTask(taskId);
  if (!task) return;
  const stageIndex = task.stages.findIndex((s) => s.status === "active" || s.status === "pending");
  if (!runState.has(taskId)) {
    // Rehydrate from the persisted task (live settings live in the Task row), not
    // from a state object that no longer exists — otherwise a resumed live-mode
    // task silently downgraded to corpus-only collection.
    runState.set(taskId, {
      raw: task.recordsFound,
      validated: [],
      dropped: 0,
      duplicatesRemoved: task.duplicatesRemoved,
      connectors: task.connectors,
      liveMode: task.liveMode === true,
      enabledCategories: task.enabledCategories ?? [],
    });
  }
  runStage(taskId, prompt, Math.max(stageIndex, 0));
}

export function cancelPipeline(taskId: string) {
  const timer = timers.get(taskId);
  if (timer) clearTimeout(timer);
  timers.delete(taskId);
  runState.delete(taskId);
  return repo.setTaskStatus(taskId, "cancelled");
}

async function isStillRunning(taskId: string): Promise<boolean> {
  const task = await repo.getTask(taskId);
  return task?.status === "running";
}

function runStage(taskId: string, prompt: string, stageIndex: number) {
  if (stageIndex >= STAGE_ORDER.length) {
    finalizePipeline(taskId, prompt).catch((e) => console.error("[pipeline] finalize failed", e));
    return;
  }

  const stageId = STAGE_ORDER[stageIndex];
  const duration = STAGE_DURATIONS[stageId];
  const steps = 10;
  const stepTime = duration / steps;
  let currentStep = 0;

  repo
    .updateStage(taskId, stageId, { status: "active", progress: 0 })
    .then(() => repo.setTaskProgress(taskId, Math.round((stageIndex / STAGE_ORDER.length) * 100)))
    .catch((e) => console.error("[pipeline] stage start failed", e));

  const tick = async () => {
    if (!(await isStillRunning(taskId))) return;

    currentStep += 1;
    const stageProgress = Math.min(100, Math.round((currentStep / steps) * 100));
    await repo.updateStage(taskId, stageId, { progress: stageProgress });

    if (currentStep >= steps) {
      await completeStage(taskId, prompt, stageIndex);
      setTimer(taskId, () => runStage(taskId, prompt, stageIndex + 1), 260);
    } else {
      setTimer(taskId, () => void tick(), stepTime);
    }
  };

  setTimer(taskId, () => void tick(), stepTime);
}

async function completeStage(taskId: string, prompt: string, stageIndex: number) {
  const stageId = STAGE_ORDER[stageIndex];
  let state = runState.get(taskId);
  if (!state) {
    state = { raw: 0, validated: [], dropped: 0, duplicatesRemoved: 0, connectors: [] };
    runState.set(taskId, state);
  }
  const logs: string[] = [];

  if (stageId === "interpret") {
    const { intent, usedAI, model } = await extractIntentAI(prompt);
    await repo.saveIntent(taskId, intent);
    logs.push(
      `Detected entity type: ${intent.entityType}`,
      `Extracted ${intent.fields.length} target fields`,
      `Confidence: ${Math.round(intent.confidence * 100)}%`,
      usedAI ? `Intent extracted via LLM (${model})` : "Intent parsed with local NLP (offline mode)"
    );
  } else if (stageId === "plan") {
    const task = await repo.getTask(taskId);
    const enabled = await repo.listEnabledSourceIds();
    const connectors = task?.intent ? planSourcesForIntent(task.intent, enabled) : enabled.slice(0, 2);
    state.connectors = connectors;
    await repo.saveTaskConnectors(taskId, connectors);
    logs.push(
      `Searching ${enabled.length} of ${CONNECTORS.length} source layers (set on the Sources page)`,
      ...connectors.map((c) => `+ ${CONNECTORS.find((x) => x.id === c)?.name ?? c}`)
    );
  } else if (stageId === "collect") {
    const task = await repo.getTask(taskId);
    const intent = task?.intent;
    if (!intent) {
      logs.push("No intent available — nothing collected");
      state.raw = 0;
      state.validated = [];
    } else {
      const enabled = await repo.listEnabledSourceIds();
      const now = new Date().toISOString();
      const connectorNames = new Map(CONNECTORS.map((c) => [c.id, c.name]));

      // Check if live mode is enabled
      const liveMode = state.liveMode === true;
      const enabledCategories = state.enabledCategories;

      let records: SourceRecord[] = [];
      const platformLabel = (p: string) => PLATFORM_NAMES[p] ?? p;

      if (liveMode && enabledCategories && enabledCategories.length > 0) {
        // HYBRID: corpus + live crawl
        logs.push(`Live mode on — curated corpus plus live ${enabledCategories.join(", ")} crawlers`);
        try {
          const { combined, platformStats, errors } = await collectHybrid(intent, {
            enabledLayers: enabled,
            enabledCategories: enabledCategories as PlatformCategory[],
            maxCorpusResults: 18,
            maxLivePerPlatform: 50,
            liveMode: true,
            taskId,
          });
          records = combined.map((r, i) => ({ ...r, taskId, id: r.id || `rec_${taskId.slice(-6)}_${i}` }));
          state.raw = records.length;

          const corpusCount = records.filter((r) => r.id.startsWith("corpus_")).length;
          const liveCount = records.length - corpusCount;
          logs.push(
            `Retrieved ${records.length} records — ${corpusCount} curated, ${liveCount} from the live web`,
            ...Object.entries(platformStats)
              .filter(([, n]) => n > 0)
              .map(([p, n]) => `+ ${platformLabel(p)}: ${n} records`),
            ...Object.entries(errors).map(([p, e]) => `! ${platformLabel(p)} failed: ${e}`)
          );
          if (liveCount === 0) {
            logs.push("Live crawlers returned nothing usable — the corpus carried this result");
          }
        } catch (err) {
          logs.push(`Live crawl unavailable, collected from the corpus instead: ${err instanceof Error ? err.message : "Unknown error"}`);
          const hits = collectFromCorpus(intent, enabled);
          records = recordsFromHits(hits, intent.fields, connectorNames, taskId, now);
          state.raw = records.length;
        }
      } else {
        // CORPUS ONLY (deterministic mode)
        const hits = collectFromCorpus(intent, enabled);
        records = recordsFromHits(hits, intent.fields, connectorNames, taskId, now);
        state.raw = records.length;

        const byConnector = new Map<string, number>();
        for (const h of hits) byConnector.set(h.connectorId, (byConnector.get(h.connectorId) ?? 0) + 1);
        const backfilled = hits.filter((h) => h.backfilled).length;
        logs.push(
          `Retrieved ${records.length} candidate records from curated corpus`,
          ...[...byConnector.entries()].map(
            ([cid, n]) => `+ ${connectorNames.get(cid) ?? cid}: ${n} records`
          )
        );
        if (backfilled > 0) {
          logs.push(
            `! ${backfilled} rows had no relevance match and were topped up to keep the table usable — flagged for review`
          );
        }
      }

      state.validated = records;
    }
  } else if (stageId === "validate") {
    // REAL validation against the columns the question asked for. Only records
    // with no name or no traceable source URL are dropped; a column the sources
    // cannot fill is reported and the row is flagged for review instead.
    const task = await repo.getTask(taskId);
    const requested = task?.intent?.fields ?? [];
    const kept: SourceRecord[] = [];
    let dropped = 0;
    const dropReasons = new Map<string, number>();
    const warned = new Map<string, number>();
    for (const r of state.validated) {
      const v = validateRecord(r, requested);
      if (!v.valid) {
        dropped++;
        for (const reason of v.reasons) dropReasons.set(reason, (dropReasons.get(reason) ?? 0) + 1);
        continue;
      }
      for (const w of v.warnings) warned.set(w, (warned.get(w) ?? 0) + 1);
      kept.push(v.warnings.length > 0 ? { ...r, flagged: true } : r);
    }
    state.validated = kept;
    state.dropped = dropped;

    const unsupported = unsupportedFields(requested);
    logs.push(
      `Checked ${state.raw} records against ${requested.length} requested columns`,
      dropped > 0
        ? `Dropped ${dropped} records that could not be traced to a source URL`
        : "Every record resolves to a live source URL",
      ...[...warned.entries()].map(([reason, n]) => `! ${reason}: ${n} records flagged for review`)
    );
    if (unsupported.length > 0) {
      logs.push(
        `Not in this knowledge base: ${unsupported.join(", ")} — delivered as empty columns`
      );
    }
  } else if (stageId === "deduplicate") {
    // REAL dedupe: normalized name+domain key.
    const before = state.validated.length;
    const { unique, removed } = dedupeRecords(state.validated);
    state.validated = unique;
    state.duplicatesRemoved = removed;
    logs.push(
      `Compared ${before} records on normalized name + domain`,
      removed > 0 ? `Removed ${removed} duplicates, ${unique.length} unique remain` : "No duplicates found"
    );
  } else if (stageId === "deliver") {
    // The deliver stage writes the answer, not just the table: the analyst brief
    // (headline, top matches, coverage, gaps, next step) is computed from the
    // exact rows being published and rendered on the task + dataset pages.
    const task = await repo.getTask(taskId);
    const recs = state.validated;
    const sourcesUsed = Array.from(new Set(recs.map((r) => r.sourceName)));
    const brief = buildAnalystBrief({
      prompt,
      records: recs,
      columns: task?.intent?.fields ?? [],
      sourcesUsed,
      intent: task?.intent ?? null,
    });
    const flagged = recs.filter((r) => r.flagged).length;
    const avg = recs.length
      ? Math.round((recs.reduce((s, r) => s + r.confidence, 0) / recs.length) * 100)
      : 0;

    logs.push(
      brief.headline,
      `${recs.length} rows published from ${sourcesUsed.length} source layer${sourcesUsed.length === 1 ? "" : "s"} · average confidence ${avg}%`,
      "Analyst brief attached: top matches, column coverage, gaps and a recommended next step",
      "Indexed for search, filter and CSV/JSON export"
    );
    if (flagged > 0) {
      logs.push(`! ${flagged} row${flagged === 1 ? "" : "s"} flagged for review inside the brief`);
    } else if (recs.length > 0) {
      logs.push("No rows flagged — the table passed validation clean");
    }
  }

  runState.set(taskId, state);
  await repo.updateStage(taskId, stageId, { status: "done", progress: 100, appendLogs: logs });
  await repo.setTaskCounts(taskId, state.validated.length || state.raw, state.duplicatesRemoved);
  await repo.setTaskProgress(taskId, Math.round(((stageIndex + 1) / STAGE_ORDER.length) * 100));
}

async function finalizePipeline(taskId: string, prompt: string) {
  const task = await repo.getTask(taskId);
  if (!task || !task.intent) return;

  // Records were really collected/validated/deduped in the stage handlers.
  // If runState was lost (server restart mid-task), rebuild deterministically
  // from the corpus so finalize never persists an empty dataset.
  const state = runState.get(taskId);
  let records = (state?.validated ?? []).map((r) => ({ ...r, taskId }));
  let duplicatesRemoved = state?.duplicatesRemoved ?? 0;
  if (records.length === 0) {
    const enabled = await repo.listEnabledSourceIds();
    const hits = collectFromCorpus(task.intent, enabled);
    const now = new Date().toISOString();
    const connectorNames = new Map(CONNECTORS.map((c) => [c.id, c.name]));
    const rebuilt = recordsFromHits(hits, task.intent.fields, connectorNames, taskId, now);
    const { unique, removed } = dedupeRecords(rebuilt);
    records = unique;
    duplicatesRemoved = removed;
  }
  const name = deriveDatasetName(prompt, task.intent);

  const datasetId = await repo.createDataset({
    taskId,
    name,
    prompt,
    columns: task.intent.fields,
    // The sources that actually produced records — not the ones that were planned.
    sourcesUsed: Array.from(new Set(records.map((r) => r.sourceName))),
    records,
  });

  await repo.setTaskCounts(taskId, records.length, duplicatesRemoved);
  await repo.setTaskProgress(taskId, 100);
  await repo.setTaskStatus(taskId, "completed");
  await repo.createWorkflow({ taskId, name, prompt, connectors: task.connectors });

  timers.delete(taskId);
  runState.delete(taskId);

  return datasetId;
}

/**
 * Project ranked corpus hits onto the columns the question asked for, stamping
 * every row with its provenance and an honest confidence/backfill flag. Used by
 * the Collect stage (corpus + live-crawl fallback) and by the finalize rebuild,
 * so all three paths produce identically shaped rows.
 */
function recordsFromHits(
  hits: CorpusHit[],
  requestedFields: string[],
  connectorNames: Map<string, string>,
  taskId: string,
  now: string
): SourceRecord[] {
  const suffix = taskId.replace(/[^a-z0-9]/gi, "").slice(-6);
  return hits.map((h, i) => {
    const { fields, filled } = fillFields(h.org, requestedFields);
    return {
      id: `rec_${suffix}_${i}`,
      taskId,
      fields,
      confidence: recordConfidence(h.score, filled, requestedFields.length),
      sourceName: connectorNames.get(h.connectorId) ?? h.connectorId,
      sourceUrl: h.org.website,
      collectedAt: now,
      // A topped-up row (no relevance signal) is disclosed, never dressed as a match.
      flagged: h.backfilled === true,
    };
  });
}

/**
 * Dataset titles should read like a result, not a truncated question:
 * "Sponsor Lead — Pune" instead of "Find sustainability-focused sponsor le".
 */
function deriveDatasetName(prompt: string, intent?: ExtractedIntent | null): string {
  const cleaned = prompt.replace(/[.?!"'`]/g, " ").replace(/\s+/g, " ").trim();

  const what =
    intent?.entityType && intent.entityType !== "Organization"
      ? intent.entityType
      : cleaned
          .replace(/^(please\s+)?(find|get|collect|list|show|gather|give me|search for|track down|i need|i'm looking for)\s+/i, "")
          .split(" ")
          .filter(Boolean)
          .slice(0, 6)
          .join(" ");

  const base = what || cleaned.slice(0, 40) || "Untitled Dataset";
  const qualifier = intent?.location ?? intent?.industry;
  const name = qualifier && !base.toLowerCase().includes(qualifier.toLowerCase())
    ? `${base} — ${qualifier}`
    : base;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
