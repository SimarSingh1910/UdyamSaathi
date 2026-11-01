import { describe, expect, it, vi } from "vitest";

// Fake LLM: "translates" by wrapping each value, so we can check chunking and caching.
const calls: number[] = [];
vi.mock("@/lib/llm", () => ({
  llmEnabled: () => true,
  parseJsonReply: (r: string | null) => (r ? JSON.parse(r) : null),
  complete: async ({ user }: { user: string }) => {
    const input = JSON.parse(user) as Record<string, string>;
    calls.push(Object.keys(input).length);
    return JSON.stringify(Object.fromEntries(Object.entries(input).map(([k, v]) => [k, `«${v}»`])));
  },
}));

const { catalog } = await import("@/lib/i18n-catalog");
const { LANGUAGES, NEEDS_REVIEW, isLangCode } = await import("@/lib/languages");
const { STRINGS } = await import("@/lib/i18n");
const { translate } = await import("@/lib/translate");

describe("languages", () => {
  it("covers English plus the 22 Eighth Schedule languages", () => {
    expect(LANGUAGES).toHaveLength(23);
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(23);
    const names = LANGUAGES.map((l) => l.english);
    for (const n of ["Assamese", "Bodo", "Dogri", "Kashmiri", "Konkani", "Maithili", "Manipuri", "Santali", "Sindhi", "Sanskrit", "Nepali"]) {
      expect(names).toContain(n);
    }
    expect(LANGUAGES.filter((l) => l.dir === "rtl").map((l) => l.code)).toEqual(["ur", "ks", "sd"]);
    expect(NEEDS_REVIEW.every(isLangCode)).toBe(true);
  });

  it("has hand-written Hindi for every fixed UI string", () => {
    for (const [key, v] of Object.entries(STRINGS)) {
      expect(v.hi, key).toBeTruthy();
    }
    expect(catalog().length).toBeGreaterThan(150);
  });
});

describe("translation", () => {
  it("translates in chunks, then serves from cache", async () => {
    const texts = catalog().map((t) => t.en);
    const first = await translate("ta", texts);
    expect(Object.keys(first)).toHaveLength(texts.length);
    expect(first["Start now"]).toBe("«Start now»");
    expect(Math.max(...calls)).toBeLessThanOrEqual(40);

    const before = calls.length;
    await translate("ta", ["Start now", "Monthly total"]);
    expect(calls.length).toBe(before); // cached, no new LLM call
  });

  it("returns English unchanged", async () => {
    expect(await translate("en", ["Hello"])).toEqual({ Hello: "Hello" });
  });
});
