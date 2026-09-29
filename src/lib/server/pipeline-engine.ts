import type { SourceRecord, StageId } from "@/types";
import { CONNECTORS } from "@/lib/collection-engine";
import {
  collectFromCorpus,
  dedupeRecords,
  planSourcesForIntent,
  recordConfidence,
  unsupportedFields,
  validateRecord,
} from "@/lib/collect";
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
  }
>();

export function startPipeline(taskId: string, prompt: string) {
  runState.set(taskId, { raw: 0, validated: [], dropped: 0, duplicatesRemoved: 0, connectors: [] });
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
    runState.set(taskId, {
      raw: task.recordsFound,
      validated: [],
      dropped: 0,
      duplicatesRemoved: task.duplicatesRemoved,
      connectors: task.connectors,
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
      // REAL collection: rank the curated corpus against the intent, searching
      // only the source layers the user has switched on.
      const enabled = await repo.listEnabledSourceIds();
      const hits = collectFromCorpus(intent, enabled);
      const now = new Date().toISOString();
      const connectorNames = new Map(CONNECTORS.map((c) => [c.id, c.name]));
      const records: SourceRecord[] = hits.map((h, i) => {
        const fields: Record<string, string | number> = {};
        let filled = 0;
        for (const f of intent.fields) {
          let v: string | number | undefined;
          switch (f) {
            case "Name": v = h.org.name; break;
            case "Company": v = h.org.name; break;
            case "Website": v = h.org.website; break;
            case "Industry": v = h.org.industry; break;
            case "Location": v = h.org.location; break;
            case "Contact Email": v = h.org.contactEmail; break;
            case "Phone": v = h.org.phone; break;
            // A column the knowledge base cannot fill stays empty rather than
            // being filled with something invented.
            default: v = undefined;
          }
          if (v !== undefined && String(v).trim() !== "") {
            fields[f] = v;
            filled++;
          } else {
            fields[f] = "—";
          }
        }
        return {
          id: `rec_${taskId.replace(/[^a-z0-9]/gi, "").slice(-6)}_${i}`,
          taskId,
          fields,
          confidence: recordConfidence(h.score, filled, intent.fields.length),
          sourceName: connectorNames.get(h.connectorId) ?? h.connectorId,
          sourceUrl: h.org.website,
          collectedAt: now,
          flagged: false,
        };
      });
      state.raw = records.length;
      state.validated = records; // validate stage filters this down
      const byConnector = new Map<string, number>();
      for (const h of hits) byConnector.set(h.connectorId, (byConnector.get(h.connectorId) ?? 0) + 1);
      logs.push(
        `Retrieved ${records.length} candidate records from curated corpus`,
        ...[...byConnector.entries()].map(
          ([cid, n]) => `+ ${connectorNames.get(cid) ?? cid}: ${n} records`
        )
      );
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
    logs.push(`Publishing ${state.validated.length} records`, "Indexing for search & filter");
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
    const rebuilt: typeof records = hits.map((h, i) => {
      const fields: Record<string, string | number> = {};
      for (const f of task.intent!.fields) {
        const v =
          f === "Name" || f === "Company" ? h.org.name
          : f === "Website" ? h.org.website
          : f === "Industry" ? h.org.industry
          : f === "Location" ? h.org.location
          : f === "Contact Email" ? h.org.contactEmail
          : f === "Phone" ? h.org.phone
          : "—";
        fields[f] = v;
      }
      const conf = recordConfidence(h.score, task.intent!.fields.length, task.intent!.fields.length);
      return {
        id: `rec_${taskId.replace(/[^a-z0-9]/gi, "").slice(-6)}_${i}`,
        taskId,
        fields,
        confidence: conf,
        sourceName: connectorNames.get(h.connectorId) ?? h.connectorId,
        sourceUrl: h.org.website,
        collectedAt: now,
        flagged: conf < 0.7,
      };
    });
    const { unique, removed } = dedupeRecords(rebuilt);
    records = unique;
    duplicatesRemoved = removed;
  }
  const name = deriveDatasetName(prompt);

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

function deriveDatasetName(prompt: string): string {
  const words = prompt.replace(/[."]/g, "").split(" ").slice(0, 6).join(" ");
  return words.length > 0 ? words : "Untitled Dataset";
}
