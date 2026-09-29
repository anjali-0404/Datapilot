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

/**
 * Extracts intent from a prompt. If OPENROUTER_API_KEY (or legacy AI_API_KEY)
 * is configured, this calls the OpenRouter chat-completions API for real
 * LLM-based extraction. Otherwise (and on any failure, so the product never
 * hard-fails a request) it falls back to the deterministic local NLP in
 * collection-engine.ts.
 *
 * Free/offline-safe models that work well here (set AI_MODEL to override):
 * - "x-ai/grok-4.1-fast:free" (default — free tier, JSON-friendly)
 * - "meta-llama/llama-3.3-70b-instruct:free"
 * - "google/gemini-2.0-flash-001" (cheap, fast)
 */
const DEFAULT_MODEL = "x-ai/grok-4.1-fast:free";

/** Which reasoning engine is live right now. Used by the Settings page. */
export function describeAI(): { configured: boolean; provider: string; model: string } {
  const configured = Boolean(process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY);
  return {
    configured,
    provider: "OpenRouter",
    model: process.env.AI_MODEL || DEFAULT_MODEL,
  };
}

export async function extractIntentAI(prompt: string): Promise<{ intent: ExtractedIntent; usedAI: boolean; model?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    return { intent: extractIntentHeuristic(prompt), usedAI: false };
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "DataPilot AI",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.1,
        // NOTE: no response_format — not all free-tier models support
        // json_object mode; the system prompt + fence cleanup handle it.
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API returned ${response.status}`);
    }

    const data = await response.json();
    let text = String(data.choices?.[0]?.message?.content ?? "").trim();
    // Some models wrap the whole reply in an array or add reasoning prefix.
    if (!text && Array.isArray(data.choices?.[0]?.message?.content)) {
      text = data.choices[0].message.content
        .map((b: { text?: string }) => b?.text ?? "")
        .join("")
        .trim();
    }
    if (!text) throw new Error("OpenRouter returned empty content");

    // Extract the first {...} block — tolerant of prose/fences around it.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("OpenRouter returned non-JSON");
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

    // Guard: LLM must return at least a usable shape; else fall back.
    if (!intent.goal || intent.fields.length === 0) throw new Error("OpenRouter returned unusable intent");

    return { intent, usedAI: true, model };
  } catch (err) {
    console.error("[extractIntentAI] falling back to local extraction:", err);
    return { intent: extractIntentHeuristic(prompt), usedAI: false };
  }
}
