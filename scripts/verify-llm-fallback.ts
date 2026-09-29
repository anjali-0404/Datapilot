// Contract tests for src/lib/server/ai.ts — provider priority, fallback chain,
// and the guarantee that intent extraction never hard-fails.
// Run: npx tsx scripts/verify-llm-fallback.ts
import { extractIntentAI, describeAI } from "@/lib/server/ai";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

type Handler = (url: string, init?: RequestInit) => Promise<Response>;
function stubFetch(handler: Handler) {
  (globalThis as { fetch: unknown }).fetch = handler as unknown;
}

function json(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const NIM_JSON = JSON.stringify({
  goal: "List EV makers in Pune",
  entityType: "Organization",
  location: "Pune",
  industry: null,
  fields: ["Name", "Website"],
  constraints: [],
  confidence: 0.9,
});

function resetEnv() {
  delete process.env.NVIDIA_API_KEY;
  delete process.env.NVIDIA_MODEL;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.AI_API_KEY;
  delete process.env.AI_MODEL;
  delete process.env.LLM_PROVIDER;
}

const realFetch = globalThis.fetch;
const realError = console.error;

async function main() {
  console.error = () => {}; // expected provider failures would otherwise spam the log
  // 1. No keys configured → not "configured", heuristic extraction still answers.
  resetEnv();
  {
    const d = describeAI();
    check("no keys → describeAI reports unconfigured", d.configured === false, `provider=${d.provider}`);
    const r = await extractIntentAI("find fintech companies in Bangalore");
    check("no keys → local NLP fallback returns an intent", r.usedAI === false && r.intent.fields.length > 0);
  }

  // 2. NVIDIA key only → NIM is called and its model is reported.
  resetEnv();
  process.env.NVIDIA_API_KEY = "nvapi-test";
  {
    const d = describeAI();
    check("NVIDIA key → provider is NVIDIA NIM", d.configured && d.provider === "NVIDIA NIM", d.model);
    check("NVIDIA default model", d.model === "meta/llama-3.1-70b-instruct", d.model);

    const urls: string[] = [];
    stubFetch(async (url) => {
      urls.push(String(url));
      return json(NIM_JSON);
    });
    const r = await extractIntentAI("find EV makers in Pune");
    check("NIM succeeds → usedAI true", r.usedAI === true, `model=${r.model}`);
    check("NIM endpoint used", urls[0]?.includes("integrate.api.nvidia.com"), urls[0]);
    check("parsed location from NIM reply", r.intent.location === "Pune", String(r.intent.location));
    check("parsed fields from NIM reply", r.intent.fields.join(",") === "Name,Website", r.intent.fields.join(","));
  }

  // 3. Both keys → NIM first; when NIM 401s, OpenRouter is tried and wins.
  resetEnv();
  process.env.NVIDIA_API_KEY = "nvapi-test";
  process.env.OPENROUTER_API_KEY = "sk-or-test";
  {
    const urls: string[] = [];
    stubFetch(async (url) => {
      urls.push(String(url));
      if (String(url).includes("nvidia")) return new Response("unauthorized", { status: 401 });
      return json(NIM_JSON.replaceAll("Pune", "Chennai"));
    });
    const r = await extractIntentAI("find EV makers in Chennai");
    check("NIM 401 → OpenRouter fallback used", r.usedAI === true && r.model === "x-ai/grok-4.1-fast:free", `model=${r.model}`);
    check("both providers attempted in order", urls.length === 2 && urls[0].includes("nvidia") && urls[1].includes("openrouter"), urls.join(" -> "));
    check("fallback reply parsed", r.intent.location === "Chennai", String(r.intent.location));
  }

  // 4. LLM_PROVIDER pins OpenRouter first even when NIM has a key.
  resetEnv();
  process.env.NVIDIA_API_KEY = "nvapi-test";
  process.env.OPENROUTER_API_KEY = "sk-or-test";
  process.env.LLM_PROVIDER = "openrouter";
  {
    const urls: string[] = [];
    stubFetch(async (url) => {
      urls.push(String(url));
      return json(NIM_JSON);
    });
    await extractIntentAI("find EV makers in Pune");
    check("LLM_PROVIDER=openrouter → OpenRouter tried first", urls[0]?.includes("openrouter"), urls[0]);
  }

  // 5. Every provider failing → deterministic local fallback, never a throw.
  resetEnv();
  process.env.NVIDIA_API_KEY = "nvapi-test";
  process.env.OPENROUTER_API_KEY = "sk-or-test";
  {
    stubFetch(async () => new Response("rate limited", { status: 429 }));
    const r = await extractIntentAI("collect open jobs for climate tech in Delhi");
    check("all providers fail → local fallback, no throw", r.usedAI === false && r.intent.fields.length > 0);

    // Malformed body from a 200 must also fall through.
    stubFetch(async () => json("Sorry, I cannot answer that."));
    const r2 = await extractIntentAI("collect open jobs for climate tech in Delhi");
    check("non-JSON 200 → local fallback", r2.usedAI === false && r2.intent.fields.length > 0);
  }


}

void main().then(() => {
  console.error = realError;
  (globalThis as { fetch: unknown }).fetch = realFetch;
  resetEnv();
  console.log(failed === 0 ? "\nAll LLM fallback checks passed" : `\n${failed} check(s) failed`);
  process.exit(failed === 0 ? 0 : 1);
});
