import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const dailyCap = () =>
  new Response(JSON.stringify({ error: { message: "Rate limit reached ... tokens per day (TPD)" } }), {
    status: 429,
    headers: { "retry-after": "300" },
  });

describe("llm failover", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("LLM_PROVIDER", "groq");
    vi.stubEnv("LLM_API_KEY", "test-key");
    vi.stubEnv("LLM_MODEL", "");
    vi.stubEnv("LLM_FALLBACK_MODELS", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("switches to another model when the configured one hits its daily cap, and rests it", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/models")) {
        return new Response(JSON.stringify({ data: [{ id: "openai/gpt-oss-120b" }, { id: "openai/gpt-oss-20b" }, { id: "whisper-large-v3" }] }));
      }
      const model = JSON.parse(String(init?.body)).model as string;
      asked.push(model);
      return model === "openai/gpt-oss-120b" ? dailyCap() : ok("hello");
    }));
    const llm = await import("@/lib/llm");

    expect(await llm.complete({ system: "s", user: "u" })).toBe("hello");
    expect(asked).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
    expect(llm.activeModel()).toBe("openai/gpt-oss-20b");

    // The capped model is resting, so the next call goes straight to the fallback.
    asked.length = 0;
    expect(await llm.complete({ system: "s", user: "u" })).toBe("hello");
    expect(asked).toEqual(["openai/gpt-oss-20b"]);
  });

  it("does not fail over on other errors", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      asked.push(JSON.parse(String(init?.body)).model);
      return new Response("bad key", { status: 401 });
    }));
    const llm = await import("@/lib/llm");
    expect(await llm.complete({ system: "s", user: "u" })).toBeNull();
    expect(asked).toHaveLength(1);
    expect(llm.lastError).toContain("401");
  });
});
