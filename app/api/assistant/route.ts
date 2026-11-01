import { NextResponse } from "next/server";
import type { ChatTurn } from "@/lib/advisor-chat";
import { cleanAnswers } from "@/lib/advisor-parse";
import { GUIDE_LABEL_KEYS, SCREENS, isActionId, type GuideLabels, type Screen } from "@/lib/app-guide";
import { assistantChat } from "@/lib/assistant";
import { isLangCode } from "@/lib/languages";

export const runtime = "nodejs";
export const maxDuration = 30;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

/**
 * POST /api/assistant
 * { history, lang, screen, labels, actions, answers?, profile?, items?, kyc?, orderId? }
 * Everything is treated as untrusted: prices come from the quote engine and the order from the store.
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });

  const history: ChatTurn[] = (Array.isArray(b.history) ? b.history : [])
    .filter((t: ChatTurn) => (t?.role === "user" || t?.role === "assistant") && typeof t.content === "string")
    .slice(-10);
  if (!history.some((t) => t.role === "user")) {
    return NextResponse.json({ error: "history must include the owner's message" }, { status: 400 });
  }

  const labels: GuideLabels = {};
  for (const k of GUIDE_LABEL_KEYS) {
    const v = str(b.labels?.[k], 60);
    if (v) labels[k] = v;
  }

  const p = b.profile;
  const profile =
    p && (p.cityTier === 1 || p.cityTier === 2)
      ? {
          cityTier: p.cityTier as 1 | 2,
          employees: Math.max(0, Math.min(10_000, Number(p.employees) || 1)),
          sites: Math.max(1, Math.min(500, Number(p.sites) || 1)),
          hasActiveGstin: p.hasActiveGstin === true,
        }
      : undefined;

  const items = (Array.isArray(b.items) ? b.items : [])
    .filter((i: { productId?: unknown }) => typeof i?.productId === "string")
    .slice(0, 50)
    .map((i: { productId: string; quantity?: unknown }) => ({
      productId: i.productId.slice(0, 20),
      quantity: Math.max(1, Math.min(100, Number(i.quantity) || 1)),
    }));

  const lines = (Array.isArray(b.lines) ? b.lines : [])
    .filter((l: { productId?: unknown }) => typeof l?.productId === "string")
    .slice(0, 30)
    .map((l: { productId: string; quantity?: unknown; on?: unknown; core?: unknown; why?: unknown }) => ({
      productId: l.productId.slice(0, 20),
      quantity: Math.max(1, Math.min(100, Number(l.quantity) || 1)),
      on: l.on !== false,
      core: l.core === true,
      why: str(l.why, 240),
    }));
  const skipped = (Array.isArray(b.skipped) ? b.skipped : [])
    .slice(0, 10)
    .map((x: { name?: unknown; why?: unknown }) => ({ name: str(x?.name, 80) ?? "", why: str(x?.why, 240) ?? "" }))
    .filter((x: { name: string }) => x.name);

  const kyc =
    b.kyc && typeof b.kyc === "object"
      ? {
          checked: b.kyc.checked === true,
          approved: b.kyc.approved === true,
          issues: (Array.isArray(b.kyc.issues) ? b.kyc.issues : []).map((x: unknown) => str(x, 200)).filter(Boolean).slice(0, 8) as string[],
        }
      : undefined;

  const result = await assistantChat({
    history,
    lang: isLangCode(b.lang) ? b.lang : "en",
    screen: SCREENS.includes(b.screen) ? (b.screen as Screen) : "advisor",
    labels,
    actions: (Array.isArray(b.actions) ? b.actions : []).filter(isActionId),
    answers: cleanAnswers(b.answers ?? {}),
    profile,
    // The quote is priced from the lines switched on when the app sends them.
    items: lines.length ? lines.filter((l: { on: boolean }) => l.on).map(({ productId, quantity }: { productId: string; quantity: number }) => ({ productId, quantity })) : items,
    lines,
    skipped,
    kyc,
    orderId: str(b.orderId, 40),
  });
  return NextResponse.json(result);
}
