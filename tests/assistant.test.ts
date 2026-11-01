import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchHowTo } from "@/lib/app-guide";
import { buildQuote } from "@/lib/quote";
import { getCatalogue } from "@/lib/catalogue";
import { formatInr } from "@/lib/i18n";

let nextReply: string | null = null;
let queue: (string | null)[] = [];
let lastSystem = "";
let lastUser = "";
let calls = 0;
vi.mock("@/lib/llm", async (orig) => ({
  ...(await orig<typeof import("@/lib/llm")>()),
  complete: async ({ system, user }: { system: string; user: string }) => {
    lastSystem = system;
    lastUser = user;
    calls++;
    return queue.length ? queue.shift()! : nextReply;
  },
}));

const { assistantChat, ownerContext, similarity, rupeeAmounts, dropSentencesWith } = await import("@/lib/assistant");

const base = {
  history: [{ role: "user" as const, content: "how do I change the language?" }],
  lang: "en" as const,
  screen: "quote" as const,
  labels: {},
  actions: ["open_language", "go_kyc", "talk_to_person"] as ("open_language" | "go_kyc" | "talk_to_person")[],
};
const profile = { cityTier: 1 as const, employees: 3, sites: 1, hasActiveGstin: true };

describe("help assistant", () => {
  beforeEach(() => {
    nextReply = null;
    queue = [];
    calls = 0;
  });

  it("answers 'where do I…' from the app guide when no LLM is available", async () => {
    const r = await assistantChat(base);
    expect(r.source).toBe("rules");
    expect(typeof r.reply === "object" && r.reply.en).toMatch(/globe button/);
    expect(r.action).toBe("open_language");
  });

  it("matches common questions to the right part of the app", () => {
    expect(matchHowTo("my GST certificate failed")?.action).toBe("go_kyc");
    expect(matchHowTo("how do I remove the static IP add-on")?.action).toBe("go_quote");
    expect(matchHowTo("I gave the wrong city")?.action).toBe("start_over");
    expect(matchHowTo("मुझे किसी से बात करनी है")?.action).toBe("talk_to_person");
    expect(matchHowTo("change my shop address")?.action).not.toBe("go_quote");
  });

  it("only offers buttons the app said are possible right now", async () => {
    nextReply = JSON.stringify({ reply: "Tap Start over on your bundle screen.", action: "start_over" });
    const r = await assistantChat({ ...base, history: [{ role: "user", content: "change answers" }] });
    expect(r.source).toBe("llm");
    expect(r.action).toBeNull();

    nextReply = JSON.stringify({ reply: "Go to KYC.", action: "go_kyc" });
    expect((await assistantChat(base)).action).toBe("go_kyc");
  });

  it("gives the model the owner's real total from the quote engine and the guide with on-screen labels", async () => {
    nextReply = JSON.stringify({ reply: "ok", action: null });
    const items = [{ productId: "P01", quantity: 1 }, { productId: "P07", quantity: 2 }];
    await assistantChat({ ...base, lang: "hi", profile, items, labels: { continueKyc: "KYC पर आगे बढ़ें" } });
    const q = buildQuote(items, profile, getCatalogue());
    expect(lastSystem).toContain(`Monthly total ${formatInr(q.monthlyTotal)}`);
    expect(lastSystem).toContain('"KYC पर आगे बढ़ें"');
    expect(lastSystem).toContain("Reply in Hindi");
  });

  it("precomputes the total without each product, since bundle prices move with the product count", () => {
    const items = [{ productId: "P01", quantity: 8 }, { productId: "P08", quantity: 7 }, { productId: "P09", quantity: 8 }];
    const ctx = ownerContext({ ...base, profile, items });
    const rest = buildQuote(items.filter((i) => i.productId !== "P09"), profile, getCatalogue());
    expect(ctx).toContain(`everything except Backup 4G/5G Failover: ${formatInr(rest.monthlyTotal)}`);
    expect(ctx).toContain("NOT placed an order yet");
  });

  it("describes KYC problems and ignores an unknown order id", () => {
    const ctx = ownerContext({ ...base, kyc: { checked: true, approved: false, issues: ["Bill is older than 90 days."] }, orderId: "NOPE" });
    expect(ctx).toContain("KYC: needs action: Bill is older than 90 days.");
    expect(ctx).not.toContain("Their order");
  });

  const lines = [
    { productId: "P02", quantity: 1, on: true, core: true, why: "Fast fibre for the office and factory floor." },
    { productId: "P23", quantity: 20, on: true, core: false, why: "Cameras on the floor you can watch from your phone." },
  ];

  it("knows why each product was suggested, what is optional, and what else they can add", () => {
    const ctx = ownerContext({ ...base, screen: "recommendation", profile, items: lines.map(({ productId, quantity }) => ({ productId, quantity })), lines, skipped: [{ name: "Leased line", why: "Too few staff." }] });
    expect(ctx).toMatch(/\[essential, ON\]: Fast fibre/);
    expect(ctx).toMatch(/\[optional add-on, ON\]: Cameras/);
    expect(ctx).toContain("Left out on purpose: Leased line (Too few staff.)");
    expect(ctx).toContain('Other products that suit their kind of business and can be added from "More you can add"');
    expect(ctx).toContain('Screen they are on now: "Recommended for you"');
    const essentialsOnly = buildQuote([{ productId: "P02", quantity: 1 }], profile, getCatalogue());
    expect(ctx).toContain(`essentials only: ${formatInr(essentialsOnly.monthlyTotal)}`);
    expect(ctx).toContain("Essentials (keep): Biz Fibre 300. Optional add-ons (can be switched off): Cloud CCTV.");
    expect(ctx).not.toContain("now: recommendation");
  });

  it("asks again when the model repeats its previous answer", async () => {
    const same = "Tap Start over on your bundle screen to change your answers and get a new bundle.";
    queue = [JSON.stringify({ reply: same, action: null }), JSON.stringify({ reply: "Keep the fibre; the cameras are optional.", action: "go_kyc" })];
    const r = await assistantChat({
      ...base,
      history: [
        { role: "user", content: "how do I change answers" },
        { role: "assistant", content: same },
        { role: "user", content: "no, tell me what I should choose" },
      ],
    });
    expect(calls).toBe(2);
    expect(lastUser).toContain("did not help");
    expect(r.reply).toBe("Keep the fibre; the cameras are optional.");
    expect(similarity(same, same)).toBe(1);
    expect(similarity(same, "Keep the fibre; the cameras are optional.")).toBeLessThan(0.3);
  });

  it("gives advice from the bundle when no LLM is available", async () => {
    const r = await assistantChat({ ...base, actions: ["go_quote"], lines, history: [{ role: "user", content: "मैं क्या-क्या चूज करूं इसमें" }] });
    expect(r.source).toBe("rules");
    expect(typeof r.reply === "object" && r.reply.en).toMatch(/keep the essentials: Biz Fibre 300.*optional: Cloud CCTV/);
    expect(r.action).toBe("go_quote");
  });

  it("reads rupee amounts in any format and script", () => {
    expect(rupeeAmounts("total ₹9,022 or ₹999–1199, leased ₹8k–12k, setup Rs. 1,500 and ₹९,०२२")).toEqual([9022, 999, 1199, 8000, 12000, 1500, 9022]);
    expect(dropSentencesWith("Keep fibre. It costs ₹123 more. Done.\n• A ₹5\n• B", (p) => p.includes("₹"))).toBe("Keep fibre. Done.\n\n• B");
  });

  it("never lets an invented price through", async () => {
    const items = lines.map(({ productId, quantity }) => ({ productId, quantity }));
    const real = buildQuote([{ productId: "P02", quantity: 1 }], profile, getCatalogue()).monthlyTotal;
    const invented = `Keep only the fibre: ${formatInr(real)} a month. Adding email makes it ₹3,646. Switch the rest off on the Quote screen.`;
    // First draft and the corrected draft both invent a number: the sentence is removed.
    queue = [JSON.stringify({ reply: invented, action: null }), JSON.stringify({ reply: invented, action: null })];
    const r = await assistantChat({ ...base, profile, items, lines });
    expect(calls).toBe(2);
    expect(lastUser).toContain("not in the data: ₹3,646");
    expect(r.reply).toContain(formatInr(real));
    expect(r.reply).not.toContain("3,646");
    expect(r.reply).toContain("Switch the rest off");
  });

  it("only suggests extras that suit their kind of business", () => {
    const kirana = { cityTier: 2 as const, employees: 2, sites: 1, hasActiveGstin: false };
    const kLines = [{ productId: "P01", quantity: 1, on: true, core: true }];
    const ctx = ownerContext({ ...base, screen: "recommendation", answers: { businessType: "Kirana store", sites: 1 }, profile: kirana, items: [{ productId: "P01", quantity: 1 }], lines: kLines });
    const suits = ctx.split("\n").find((l) => l.startsWith("Other products that suit"))!;
    const notFor = ctx.split("\n").find((l) => l.startsWith("Made for other kinds"))!;
    expect(ctx).toContain("Their kind of business: Micro retail & services.");
    expect(suits).not.toContain("Cloud Email & Office Suite");
    expect(suits).not.toContain("Endpoint Security");
    expect(notFor).toContain("Cloud Email & Office Suite (for Professional office, Multi-site business, Small manufacturer)");
  });
});
