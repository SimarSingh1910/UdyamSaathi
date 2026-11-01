import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseByKeywords } from "@/lib/advisor-parse";

// Scripted LLM so the conversation logic can be tested without a network.
let nextReply: string | null = null;
let lastSystem = "";
vi.mock("@/lib/llm", async (orig) => ({
  ...(await orig<typeof import("@/lib/llm")>()),
  complete: async ({ system }: { system: string }) => {
    lastSystem = system;
    return nextReply;
  },
}));

const { advisorChat, missing } = await import("@/lib/advisor-chat");

describe("advisor chat", () => {
  beforeEach(() => {
    nextReply = null;
  });

  it("answers a question, keeps known facts and asks for the next one", async () => {
    nextReply = JSON.stringify({
      reply: "AirFiber is wireless and installs in about 2 days. How many people work with you?",
      updates: { businessType: "Pharmacy", city: "Pune" },
      handoff: false,
    });
    const r = await advisorChat({
      history: [{ role: "user", content: "I run a pharmacy in Pune. What is AirFiber?" }],
      answers: {},
      lang: "en",
      pending: "businessType",
    });
    expect(r.source).toBe("llm");
    expect(r.updates).toMatchObject({ businessType: "Pharmacy", city: "Pune" });
    expect(r.next).toBe("employees");
    expect(r.reply).toMatch(/AirFiber/);
  });

  it("grounds the model in the live catalogue and the owner's language", async () => {
    nextReply = JSON.stringify({ reply: "ठीक है", updates: {}, handoff: false });
    await advisorChat({ history: [{ role: "user", content: "नमस्ते" }], answers: {}, lang: "hi", pending: "businessType" });
    expect(lastSystem).toMatch(/Biz Fibre 100/);
    expect(lastSystem).toMatch(/Reply in Hindi, in the Devanagari script/);
    expect(lastSystem).toMatch(/Never invent products, prices/);
  });

  it("drops invalid facts the model makes up", async () => {
    nextReply = JSON.stringify({
      reply: "Got it.",
      updates: { businessType: "Spaceship factory", employees: -3, hasGstin: "maybe", needs: ["cctv", "teleport"] },
      handoff: false,
    });
    const r = await advisorChat({ history: [{ role: "user", content: "hi" }], answers: {}, lang: "en", pending: "businessType" });
    expect(r.updates).toEqual({ needs: ["cctv"] });
  });

  it("passes on a request to talk to a person", async () => {
    nextReply = JSON.stringify({ reply: "A local partner will call you.", updates: {}, handoff: true });
    const r = await advisorChat({
      history: [{ role: "user", content: "Can someone call me about early exit fees?" }],
      answers: {},
      lang: "en",
      pending: "businessType",
    });
    expect(r.handoff).toBe(true);
  });

  it("falls back to keyword understanding when the AI is unavailable", async () => {
    nextReply = null;
    const r = await advisorChat({
      history: [{ role: "user", content: "haan" }],
      answers: { businessType: "Salon", city: "Delhi", employees: 3, sites: 1, currentInternet: "Mobile hotspot", needs: [] },
      lang: "hi",
      pending: "hasGstin",
    });
    expect(r.source).toBe("rules");
    expect(r.reply).toBeNull();
    expect(r.updates.hasGstin).toBe(true);
    expect(r.next).toBeNull();
  });

  it("lists missing facts in question order", () => {
    expect(missing({ businessType: "Salon", employees: 2 })).toEqual(["city", "sites", "currentInternet", "needs", "hasGstin"]);
  });
});

describe("advisor chat: staying in sync", () => {
  it("reports which question it asked and switches language on request", async () => {
    nextReply = JSON.stringify({
      reply: "ज़रूर! आपका बिज़नेस किस तरह का है?",
      updates: {},
      asking: "businessType",
      language: "hi",
      handoff: false,
    });
    const r = await advisorChat({ history: [{ role: "user", content: "can we talk in hindi?" }], answers: {}, lang: "en", pending: "businessType" });
    expect(r.asking).toBe("businessType");
    expect(r.language).toBe("hi");
  });

  it("records an unlisted business as the closest Other type", async () => {
    nextReply = JSON.stringify({
      reply: "Which city is the factory in?",
      updates: { businessType: "Other manufacturing unit" },
      asking: "city",
      language: null,
      handoff: false,
    });
    const r = await advisorChat({
      history: [{ role: "user", content: "I have a factory making industrial cleaning equipment" }],
      answers: {},
      lang: "en",
      pending: "businessType",
    });
    expect(r.updates.businessType).toBe("Other manufacturing unit");
    expect(r.next).toBe("city");
    expect(lastSystem).toMatch(/Other manufacturing unit/);
  });

  it("ignores made-up language codes and question keys", async () => {
    nextReply = JSON.stringify({ reply: "ok", updates: {}, asking: "favouriteColour", language: "klingon", handoff: false });
    const r = await advisorChat({ history: [{ role: "user", content: "hi" }], answers: {}, lang: "en", pending: "businessType" });
    expect(r.asking).toBeNull();
    expect(r.language).toBeNull();
  });
});

describe("keyword rules and questions", () => {
  it("does not take a question about a product as what the owner uses today", () => {
    expect(parseByKeywords("what is the early exit fee if I cancel the leased line after 6 months?", "employees").currentInternet).toBeUndefined();
    expect(parseByKeywords("क्या लीज्ड लाइन के लिए leased line ज़रूरी है", "employees").currentInternet).toBeUndefined();
  });
  it("still records it when it is a statement or the answer to that question", () => {
    expect(parseByKeywords("we have a leased line", "employees").currentInternet).toBe("Leased line");
    expect(parseByKeywords("leased line?", "currentInternet").currentInternet).toBe("Leased line");
  });
});

describe("asking flag", () => {
  it("is dropped when the reply does not actually ask anything, so the scripted question follows", async () => {
    const { advisorChat } = await import("@/lib/advisor-chat");
    nextReply = JSON.stringify({ reply: "Your business is a cleaning equipment factory.", updates: { businessType: "Other manufacturing unit" }, asking: "city" });
    const r = await advisorChat({ history: [{ role: "user", content: "I have a factory" }], answers: {}, lang: "en", pending: "businessType" });
    expect(r.next).toBe("city");
    expect(r.asking).toBeNull();

    nextReply = JSON.stringify({ reply: "Got it, a factory. Which city is it in?", updates: { businessType: "Other manufacturing unit" }, asking: "city" });
    const r2 = await advisorChat({ history: [{ role: "user", content: "I have a factory" }], answers: {}, lang: "en", pending: "businessType" });
    expect(r2.asking).toBe("city");
  });
});
