import type { ExtractedIntent } from "@/types";
import { extractIntent as extractIntentHeuristic } from "@/lib/collection-engine";

const SYSTEM_PROMPT = `You extract structured data-collection intent from a plain-English request.
Respond with ONLY a JSON object (no markdown, no prose) matching this exact shape:
{
  "goal": string,
  "entityType": string,
  "location": string | null,
  "industry": string | null,
  "fields": string[],
  "constraints": string[],
  "confidence": number (0 to 1)
}
"fields" should be the concrete data columns the user wants (e.g. "Website", "Industry",
"Contact Email"). "constraints" should be short human-readable filters implied by the
prompt. Keep it concise.`;

/** NVIDIA NIM (build.nvidia.com) — OpenAI-compatible chat completions. */
const NVIDIA_DEFAULT_MODEL = "meta/llama-3.1-70b-instruct";
/** OpenRouter — free-tier JSON-friendly default. */
const OPENROUTER_DEFAULT_MODEL = "x-ai/grok-4.1-fast:free";

type ProviderId = "nvidia" | "openrouter";

interface Provider {
  id: ProviderId;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Which reasoning engines are configured, in the order they will be tried.
 *
 * NVIDIA NIM is preferred when `NVIDIA_API_KEY` is set (free research keys from
 * build.nvidia.com, and the same key already powers search-term expansion in
 * crawler-service). OpenRouter is tried next if its key exists. `LLM_PROVIDER`
 * can pin the order to "nvidia" or "openrouter".
 */
function configuredProviders(): Provider[] {
  const nvidiaKey = process.env.NVIDIA_API_KEY?.trim();
  const openrouterKey = (process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY)?.trim();

  const providers: Provider[] = [];
  if (nvidiaKey) {
    const base = (process.env.NVIDIA_NIM_BASE_URL?.trim() || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
    providers.push({
      id: "nvidia",
      label: "NVIDIA NIM",
      baseUrl: `${base}/chat/completions`,
      apiKey: nvidiaKey,
      model: process.env.NVIDIA_MODEL?.trim() || NVIDIA_DEFAULT_MODEL,
    });
  }
  if (openrouterKey) {
    providers.push({
      id: "openrouter",
      label: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: openrouterKey,
      model: process.env.AI_MODEL?.trim() || OPENROUTER_DEFAULT_MODEL,
    });
  }

  const forced = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (forced) {
    providers.sort((a, b) => (a.id === forced ? -1 : b.id === forced ? 1 : 0));
  }
  return providers;
}

/** Which reasoning engine is live right now. Used by the Settings page. */
export function describeAI(): { configured: boolean; provider: string; model: string; fallback: string | null } {
  const providers = configuredProviders();
  if (providers.length === 0) {
    return { configured: false, provider: "None", model: "Local NLP", fallback: null };
  }
  return {
    configured: true,
    provider: providers[0].label,
    model: providers[0].model,
    fallback: providers[1]?.label ?? null,
  };
}

/** One provider call → the raw assistant text. */
async function callChat(provider: Provider, prompt: string): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${provider.apiKey}`,
  };
  if (provider.id === "openrouter") {
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    headers["X-Title"] = "DataPilot AI";
  }

  const response = await fetch(provider.baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.1,
      // NOTE: no response_format — free-tier and NIM models differ on
      // json_object support; the fence cleanup below handles both.
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`${provider.label} API returned ${response.status}`);
  }

  const data = await response.json();
  let text = String(data.choices?.[0]?.message?.content ?? "").trim();
  if (!text && Array.isArray(data.choices?.[0]?.message?.content)) {
    text = data.choices[0].message.content
      .map((b: { text?: string }) => b?.text ?? "")
      .join("")
      .trim();
  }
  if (!text) throw new Error(`${provider.label} returned empty content`);
  return text;
}

/** Provider text → typed intent, or a thrown error the caller can fall past. */
function parseIntent(text: string, prompt: string): ExtractedIntent {
  // Extract the first {...} block — tolerant of prose/fences around it.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("model returned non-JSON");
  const parsed = JSON.parse(text.slice(start, end + 1));

  const intent: ExtractedIntent = {
    goal: parsed.goal ?? prompt,
    entityType: parsed.entityType ?? "Organization",
    location: parsed.location ?? undefined,
    industry: parsed.industry ?? undefined,
    fields: Array.isArray(parsed.fields) && parsed.fields.length > 0 ? parsed.fields : ["Name", "Website"],
    constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.85,
  };

  // Guard: LLM must return at least a usable shape; else fall through.
  if (!intent.goal || intent.fields.length === 0) throw new Error("model returned unusable intent");
  return intent;
}

/**
 * Extracts intent from a prompt. Tries each configured LLM in turn (NVIDIA NIM
 * first, then OpenRouter) so a rate-limited free tier never blocks the product.
 * If every provider fails — and always, when no key is configured — it falls
 * back to the deterministic local NLP in collection-engine.ts, so a request
 * never hard-fails.
 */
export async function extractIntentAI(prompt: string): Promise<{ intent: ExtractedIntent; usedAI: boolean; model?: string }> {
  const providers = configuredProviders();

  for (const provider of providers) {
    try {
      const text = await callChat(provider, prompt);
      const intent = parseIntent(text, prompt);
      return { intent, usedAI: true, model: provider.model };
    } catch (err) {
      console.error(`[extractIntentAI] ${provider.label} failed:`, err);
    }
  }

  return { intent: extractIntentHeuristic(prompt), usedAI: false };
}
