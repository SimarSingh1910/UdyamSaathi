import { FAQ, catalogueBrief, type ChatTurn } from "./advisor-chat";
import type { PartialAnswers } from "./advisor-parse";
import { ACTION_IDS, GENERIC_HELP, appGuide, isActionId, matchHowTo, type ActionId, type GuideLabels, type Screen } from "./app-guide";
import { getCatalogue } from "./catalogue";
import type { BusinessProfile } from "./eligibility";
import { formatInr, type Text } from "./i18n";
import { languageOf, type LangCode } from "./languages";
import { complete, parseJsonReply } from "./llm";
import { STATUS_LABEL, expectedDays } from "./order-flow";
import { buildQuote, type QuoteItemInput } from "./quote";
import { getOrder } from "./store";

/**
 * The in-app assistant: a help desk that knows the app's screens, the owner's own
 * bundle, price, KYC and order, and the catalogue. Facts it states come from the
 * quote engine and the order store, never from the model. Without an LLM it still
 * answers "where do I…" questions from the app guide.
 */

export interface AssistantInput {
  history: ChatTurn[];
  lang: LangCode;
  screen: Screen;
  /** UI labels in the owner's language, so directions match the screen. */
  labels: GuideLabels;
  /** Buttons the app can offer right now. */
  actions: ActionId[];
  answers?: PartialAnswers;
  profile?: BusinessProfile;
  /** Products currently switched on in the quote. */
  items?: QuoteItemInput[];
  kyc?: { checked: boolean; approved: boolean; issues: string[] };
  orderId?: string;
}

export interface AssistantResult {
  /** A string written by the model in the owner's language, or a built-in answer to translate. */
  reply: string | Text;
  action: ActionId | null;
  source: "llm" | "rules";
}

/** The owner's situation, computed on the server from trusted sources. */
export function ownerContext(input: AssistantInput): string {
  const out: string[] = [`Screen they are on now: ${input.screen}.`];

  const known = Object.entries(input.answers ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  if (known.length) out.push(`Their business: ${known.join("; ")}.`);

  if (input.profile && input.items?.length) {
    const catalogue = getCatalogue();
    const q = buildQuote(input.items, input.profile, catalogue);
    const lines = q.lines.map((l) => `${l.name}${l.quantity > 1 ? ` × ${l.quantity}` : ""} ${formatInr(l.monthly)}/month before GST`);
    out.push(
      `Their bundle right now: ${lines.join("; ")}. Monthly total ${formatInr(q.monthlyTotal)} including GST` +
        `${q.setupTotal ? `, one-time setup ${formatInr(q.setupTotal)}` : ""}, contract ${q.contractMonths} months, ` +
        `everything working in about ${q.expectedActivationDays} days` +
        `${q.monthlySavings ? `, saving ${formatInr(q.monthlySavings)}/month as a bundle` : ""}.` +
        `${q.issues.length ? ` Problems to fix before KYC: ${q.issues.map((i) => i.message).join(" ")}` : ""}`,
    );
    // Bundle prices move with the number of products, so precompute instead of letting the model subtract.
    if (q.lines.length > 1) {
      const without = q.lines.map((l) => {
        const rest = buildQuote(input.items!.filter((i) => i.productId !== l.productId), input.profile!, catalogue);
        return `without ${l.name}: ${formatInr(rest.monthlyTotal)}${rest.issues.length ? " (would leave a problem to fix)" : ""}`;
      });
      out.push(`If they switch off one product, the new monthly total including GST would be: ${without.join("; ")}.`);
    }
    if (!input.profile.hasActiveGstin) out.push("They have no active GST registration, so products that need GST are not in their bundle.");
  }

  if (input.kyc) {
    out.push(
      !input.kyc.checked
        ? "KYC: documents not checked yet."
        : input.kyc.approved
          ? "KYC: all documents passed."
          : `KYC: needs action: ${input.kyc.issues.join(" ")}`,
    );
  }

  const order = input.orderId ? getOrder(input.orderId) : undefined;
  if (!order && input.screen !== "tracker") {
    out.push("They have NOT placed an order yet, so every answer and product can still be changed in the app.");
  }
  if (order) {
    const days = expectedDays(order);
    out.push(
      `Their order ${order.id}: status "${STATUS_LABEL[order.status].en}". ` +
        `Placed ${new Date(order.createdAt).toISOString().slice(0, 10)}; all services expected about ${days.active} days after ordering. ` +
        `${order.installSlot ? `Installation visit: ${order.installSlot}${order.engineer ? ` by ${order.engineer}` : ""}. ` : "Installation not booked yet. "}` +
        `Products: ${order.lines.map((l) => `${l.name} (${l.status})`).join(", ")}. Monthly ${formatInr(order.monthlyTotal)}.`,
    );
  }
  return out.join("\n");
}

export function assistantPrompt(input: AssistantInput): string {
  const L = languageOf(input.lang);
  const actions = input.actions.length ? input.actions.join(", ") : "none";
  return `You are the help assistant inside the UdyamSaathi app, where Indian small-business owners buy Accel Business internet, phone and IT services. You know every screen of the app and the owner's own bundle and order.

Rules:
- Reply in ${L.english}, in the ${L.script} script, in simple everyday words. Keep product names, ₹ amounts and GST/KYC/UPI/WhatsApp in English.
- At most 4 short sentences. Be specific: name the screen and the exact button (as quoted in the guide) and where it is.
- Use ONLY the app guide, the owner's details, the catalogue and the FAQ below. Never invent screens, buttons, products, prices, dates or policies. If you don't know, say so and offer a partner call.
- For their total, products or order status, use the numbers in "Owner right now" exactly. Never calculate a price yourself; if the number you need is not given, say the Quote screen shows it instantly.
- You cannot change anything yourself. You may offer ONE button by setting "action" to one of: ${actions}. Only offer it when it takes them where they need to go; otherwise null. Don't mention action names in the reply.
- Stay on topic: the app, their business connection and Accel services. Politely decline anything else.
- If they want a person, or ask something only a partner can do, set "action" to "talk_to_person" if available.

App guide:
${appGuide(input.labels)}

Owner right now:
${ownerContext(input)}

Catalogue (₹ per month before GST, "12m min" = 12-month minimum contract, "~3d install" = installed in about 3 days):
${catalogueBrief()}

FAQ:${FAQ}

Respond with JSON only: {"reply": string, "action": one of [${ACTION_IDS.join(", ")}] or null}`;
}

export async function assistantChat(input: AssistantInput): Promise<AssistantResult> {
  const history = input.history.slice(-10).map((t) => ({ ...t, content: t.content.slice(0, 600) }));
  const last = [...history].reverse().find((t) => t.role === "user")?.content ?? "";
  const allowed = (a: unknown): ActionId | null => (isActionId(a) && input.actions.includes(a) ? a : null);

  const transcript = history.map((t) => `${t.role === "user" ? "Owner" : "Assistant"}: ${t.content}`).join("\n");
  const raw = parseJsonReply<{ reply?: unknown; action?: unknown }>(
    await complete({
      system: assistantPrompt(input),
      user: `Conversation so far:\n${transcript}\n\nReply to the owner's last message.`,
      json: true,
      timeoutMs: 15_000,
    }),
  );
  if (raw && typeof raw.reply === "string" && raw.reply.trim()) {
    return { reply: raw.reply.trim().slice(0, 900), action: allowed(raw.action), source: "llm" };
  }

  // No LLM: answer "where do I…" questions from the app guide.
  const howTo = matchHowTo(last);
  return { reply: howTo?.answer ?? GENERIC_HELP, action: allowed(howTo?.action), source: "rules" };
}

