import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchHowTo } from "@/lib/app-guide";
import { buildQuote } from "@/lib/quote";
import { getCatalogue } from "@/lib/catalogue";
import { formatInr } from "@/lib/i18n";

let nextReply: string | null = null;
let lastSystem = "";
vi.mock("@/lib/llm", async (orig) => ({
  ...(await orig<typeof import("@/lib/llm")>()),
  complete: async ({ system }: { system: string }) => {
    lastSystem = system;
    return nextReply;
  },
}));

const { assistantChat, ownerContext } = await import("@/lib/assistant");

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
    expect(ctx).toContain(`without Backup 4G/5G Failover: ${formatInr(rest.monthlyTotal)}`);
    expect(ctx).toContain("NOT placed an order yet");
  });

  it("describes KYC problems and ignores an unknown order id", () => {
    const ctx = ownerContext({ ...base, kyc: { checked: true, approved: false, issues: ["Bill is older than 90 days."] }, orderId: "NOPE" });
    expect(ctx).toContain("KYC: needs action: Bill is older than 90 days.");
    expect(ctx).not.toContain("Their order");
  });
});
