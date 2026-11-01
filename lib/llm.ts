/**
 * Thin, provider-agnostic LLM client. Set LLM_PROVIDER (gemini | groq | openai | anthropic)
 * and LLM_API_KEY. With no key the app still works: callers fall back to rules.
 */

export type Provider = "gemini" | "groq" | "openai" | "anthropic";

const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: "gemini-2.5-flash",
  groq: "openai/gpt-oss-120b",
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
};

export function llmConfig(): { provider: Provider; key: string; model: string } | null {
  const provider = (process.env.LLM_PROVIDER ?? "").toLowerCase() as Provider;
  const key = process.env.LLM_API_KEY ?? "";
  if (!key || !(provider in DEFAULT_MODELS)) return null;
  return { provider, key, model: process.env.LLM_MODEL || DEFAULT_MODELS[provider] };
}

export const llmEnabled = () => llmConfig() !== null;

/** Model that answered the last call (may be a fallback). */
let resolvedModel: string | null = null;
/** Last failure, for the status endpoint. */
export let lastError: string | null = null;
/** Recent call events (status codes, waits, failovers), for the status probe. */
export const trace: string[] = [];
const note = (msg: string) => {
  trace.push(`${new Date().toISOString().slice(11, 19)} ${msg}`);
  if (trace.length > 30) trace.shift();
};
export const activeModel = () => resolvedModel ?? llmConfig()?.model ?? null;

/**
 * Fallback order when the configured model is rate-limited (free tiers cap tokens per
 * model per day) or retired. Override with LLM_FALLBACK_MODELS=a,b,c.
 */
const PREFERRED = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "moonshotai/kimi-k2-instruct",
  "llama-3.1-8b-instant",
  "gpt-4o-mini",
];

/** Models resting after a long rate limit or a 404, and when they can be tried again. */
const coolingUntil = new Map<string, number>();
let availableModels: string[] | null = null;
/** Chat models this key can use (after the first failover lookup), for the status probe. */
export const knownModels = () => availableModels;

async function listModels(base: string, key: string, signal: AbortSignal): Promise<string[]> {
  if (availableModels) return availableModels;
  try {
    const res = await fetch(`${base}/models`, { headers: { authorization: `Bearer ${key}` }, signal });
    if (!res.ok) return [];
    const ids: string[] = ((await res.json())?.data ?? []).map((m: { id: string }) => m.id);
    availableModels = ids.filter((id) => !/whisper|tts|orpheus|guard|safeguard|embed/i.test(id));
    return availableModels;
  } catch {
    return [];
  }
}

function fallbackModels(primary: string, available: string[]): string[] {
  const env = (process.env.LLM_FALLBACK_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  if (env.length) return [primary, ...env];
  // Preferred models first, then any other general chat model the key offers.
  const others = available.filter((m) => !PREFERRED.includes(m) && !/compound|prompt|allam|tool-use|vision|distil/i.test(m));
  return [...new Set([primary, ...PREFERRED.filter((m) => available.includes(m)), ...others])];
}

/**
 * fetch that waits and retries when the provider says "too many requests" (429) for a
 * few seconds only. Longer waits (e.g. a daily token cap) are returned to the caller,
 * which switches model instead of keeping the owner waiting.
 */
async function fetchWithRetry(url: string, init: RequestInit, retries = 2): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const t0 = Date.now();
    const res = await fetch(url, init);
    note(`${res.status} in ${Date.now() - t0}ms`);
    if (res.status !== 429 || attempt >= retries) return res;
    const after = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(after) && after > 0 ? after * 1000 : 2000 * (attempt + 1);
    if (waitMs > 8000) return res;
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

interface CompleteArgs {
  system: string;
  user: string;
  /** Ask the model for a JSON object and parse it. */
  json?: boolean;
  timeoutMs?: number;
}

export async function complete(args: CompleteArgs): Promise<string | null> {
  const cfg = llmConfig();
  if (!cfg) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), args.timeoutMs ?? 12_000);

  try {
    if (cfg.provider === "gemini") {
      const res = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent`,
        {
          method: "POST",
          signal: ctrl.signal,
          headers: { "content-type": "application/json", "x-goog-api-key": cfg.key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: args.system }] },
            contents: [{ role: "user", parts: [{ text: args.user }] }],
            generationConfig: {
              temperature: 0.2,
              ...(args.json ? { responseMimeType: "application/json" } : {}),
            },
          }),
        },
      );
      if (!res.ok) throw new Error(`gemini ${res.status} ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? null;
    }

    if (cfg.provider === "openai" || cfg.provider === "groq") {
      // Groq serves an OpenAI-compatible API.
      const base = cfg.provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1";
      const call = (model: string, jsonMode = !!args.json) =>
        fetchWithRetry(`${base}/chat/completions`, {
          method: "POST",
          signal: ctrl.signal,
          headers: { "content-type": "application/json", authorization: `Bearer ${cfg.key}` },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            // gpt-oss is a reasoning model; keep it fast for a chat UI.
            ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
            messages: [
              { role: "system", content: args.system },
              { role: "user", content: args.user },
            ],
            ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          }),
        });

      // Try the configured model, then fall over to others the key can use when one is
      // rate-limited for long (429), overloaded (503) or retired (404).
      const tried = new Set<string>();
      let fallbacks: string[] | null = null;
      const started = Date.now();
      const budget = args.timeoutMs ?? 12_000;
      const nextModel = async (): Promise<string | null> => {
        const free = (m: string) => !tried.has(m) && (coolingUntil.get(m) ?? 0) <= Date.now();
        if (free(cfg.model)) return cfg.model;
        fallbacks ??= fallbackModels(cfg.model, await listModels(base, cfg.key, ctrl.signal));
        const pick = fallbacks.find(free);
        if (pick) return pick;
        // Everything is resting. If one comes back within a few seconds (a per-minute
        // limit), wait for it rather than giving up; a daily cap is not worth waiting for.
        const soonest = fallbacks
          .map((m) => ({ m, at: coolingUntil.get(m) ?? 0 }))
          .sort((a, b) => a.at - b.at)[0];
        const waitMs = soonest ? soonest.at - Date.now() : Infinity;
        if (waitMs > 10_000 || Date.now() - started + waitMs > budget - 3_000) return null;
        note(`waiting ${Math.round(waitMs / 1000)}s for ${soonest.m}`);
        await new Promise((r) => setTimeout(r, Math.max(0, waitMs)));
        tried.delete(soonest.m);
        return soonest.m;
      };
      let res: Response | null = null;
      for (let n = 0, model = await nextModel(); model && n < 5; n++, model = await nextModel()) {
        tried.add(model);
        res = await call(model);
        // Groq's JSON mode occasionally rejects a valid answer; retry once in plain mode
        // (the reply is still parsed as JSON by the caller).
        if (res.status === 400 && args.json && (await res.clone().text()).includes("json_validate_failed")) {
          res = await call(model, false);
        }
        if (res.ok) {
          if (model !== cfg.model) note(`answered by fallback ${model}`);
          resolvedModel = model;
          break;
        }
        if (![404, 429, 503].includes(res.status)) break;
        const after = Number(res.headers.get("retry-after"));
        const restMs = res.status === 404 ? 6 * 3_600_000 : Number.isFinite(after) && after > 0 ? after * 1000 : 60_000;
        coolingUntil.set(model, Date.now() + restMs);
        const why = (await res.clone().text()).match(/"message":"([^"]{0,120})/)?.[1] ?? "";
        note(`${model} ${res.status}, resting ${Math.round(restMs / 1000)}s ${why}`);
        console.warn(`[llm] ${model} ${res.status}, trying another model. ${why}`);
      }
      if (!res) throw new Error("every model is resting after rate limits; try again shortly");
      if (!res.ok) throw new Error(`${cfg.provider} ${res.status} ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return data?.choices?.[0]?.message?.content ?? null;
    }

    const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 800,
        temperature: 0.2,
        system: args.json ? `${args.system}\nRespond with a single JSON object only.` : args.system,
        messages: [{ role: "user", content: args.user }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status} ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data?.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? null;
  } catch (err) {
    lastError = (err as Error).message;
    note(`failed: ${lastError}`);
    console.warn(`[llm] ${cfg.provider} call failed: ${lastError}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Parse a JSON object out of a model reply, tolerating code fences. */
export function parseJsonReply<T>(reply: string | null): T | null {
  if (!reply) return null;
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}
