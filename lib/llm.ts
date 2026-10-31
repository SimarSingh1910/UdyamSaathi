/**
 * Thin, provider-agnostic LLM client. Set LLM_PROVIDER (gemini | openai | anthropic)
 * and LLM_API_KEY. With no key the app still works: callers fall back to rules.
 */

export type Provider = "gemini" | "openai" | "anthropic";

const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: "gemini-2.5-flash",
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
      const res = await fetch(
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
      if (!res.ok) throw new Error(`gemini ${res.status}`);
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? null;
    }

    if (cfg.provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify({
          model: cfg.model,
          temperature: 0.2,
          messages: [
            { role: "system", content: args.system },
            { role: "user", content: args.user },
          ],
          ...(args.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!res.ok) throw new Error(`openai ${res.status}`);
      const data = await res.json();
      return data?.choices?.[0]?.message?.content ?? null;
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
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
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    return data?.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? null;
  } catch (err) {
    console.warn(`[llm] ${cfg.provider} call failed: ${(err as Error).message}`);
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
