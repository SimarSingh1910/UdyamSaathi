import { FAQ, catalogueBrief, type ChatTurn } from "./advisor-chat";
import type { PartialAnswers } from "./advisor-parse";
import { ACTION_IDS, GENERIC_HELP, appGuide, isActionId, matchHowTo, screenName, type ActionId, type GuideLabels, type Screen } from "./app-guide";
import { getCatalogue, type SegmentCode } from "./catalogue";
import { SEGMENT_LABELS, segmentFor } from "./advisor";
import { checkProductEligibility, type BusinessProfile } from "./eligibility";
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
  /** Every line of the bundle, including ones switched off, with why it was suggested. */
  lines?: { productId: string; quantity: number; on: boolean; core: boolean; why?: string }[];
  /** Products the recommender left out on purpose, and why. */
  skipped?: { name: string; why: string }[];
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
export async function ownerContext(input: AssistantInput): Promise<string> {
  const out: string[] = [`Screen they are on now: ${screenName(input.screen, input.labels)}.`];

  const known = Object.entries(input.answers ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  if (known.length) out.push(`Their business: ${known.join("; ")}.`);

  if (input.profile && input.items?.length) {
    const catalogue = await getCatalogue();
    const q = buildQuote(input.items, input.profile, catalogue);
    const lines = q.lines.map((l) => `${l.name}${l.quantity > 1 ? ` × ${l.quantity}` : ""} ${formatInr(l.monthly)}/month before GST`);
    out.push(
      `Their bundle right now: ${lines.join("; ")}. Monthly total ${formatInr(q.monthlyTotal)} including GST` +
        `${q.setupTotal ? `, one-time setup ${formatInr(q.setupTotal)}` : ""}, contract ${q.contractMonths} months, ` +
        `everything working in about ${q.expectedActivationDays} days` +
        `${q.monthlySavings ? `, saving ${formatInr(q.monthlySavings)}/month as a bundle` : ""}.` +
        `${q.issues.length ? ` Problems to fix before KYC: ${q.issues.map((i) => i.message).join(" ")}` : ""}`,
    );
    // Bundle prices move with the number of products, so precompute the totals for the
    // choices owners usually make instead of letting the model add or subtract.
    const total = (items: QuoteItemInput[]) => {
      const r = buildQuote(items, input.profile!, catalogue);
      return `${formatInr(r.monthlyTotal)}${r.issues.length ? " (leaves a problem to fix)" : ""}`;
    };
    const nameOf = (id: string) => catalogue.find((p) => p.id === id)?.name ?? id;
    const onLines = (input.lines ?? []).filter((l) => l.on && catalogue.some((p) => p.id === l.productId));
    const essentials = onLines.filter((l) => l.core);
    const optional = onLines.filter((l) => !l.core);
    const pick = (ls: typeof onLines) => ls.map(({ productId, quantity }) => ({ productId, quantity }));
    if (onLines.length) {
      out.push(
        `Essentials (keep): ${essentials.map((l) => nameOf(l.productId)).join(", ") || "none"}. ` +
          `Optional add-ons (can be switched off): ${optional.map((l) => nameOf(l.productId)).join(", ") || "none"}.`,
      );
    }
    const choices: string[] = [`everything as now: ${formatInr(q.monthlyTotal)}`];
    if (essentials.length && optional.length) {
      choices.push(`essentials only: ${total(pick(essentials))}`);
      if (optional.length > 1) {
        for (const o of optional) choices.push(`essentials + ${nameOf(o.productId)} only: ${total(pick([...essentials, o]))}`);
      }
    }
    if (q.lines.length > 1) {
      for (const l of q.lines) choices.push(`everything except ${l.name}: ${total(input.items.filter((i) => i.productId !== l.productId))}`);
    }
    out.push(`Monthly totals including GST for common choices (quote only the one that matches exactly what you suggest): ${choices.join("; ")}.`);
    out.push("For any other combination, the exact total is shown instantly on the Quote screen; do not estimate it.");
    // Why each line is there, so the assistant can advise what to keep or drop.
    const byId = new Map(catalogue.map((p) => [p.id, p]));
    if (input.lines?.length) {
      const why = input.lines
        .filter((l) => byId.has(l.productId))
        .map((l) => {
          const p = byId.get(l.productId)!;
          return `- ${p.name}${l.quantity > 1 ? ` × ${l.quantity}` : ""} [${l.core ? "essential" : "optional add-on"}, ${l.on ? "ON" : "switched OFF"}]: ${l.why ?? p.description}`;
        });
      out.push(`Why each product was suggested for them:\n${why.join("\n")}`);
    }
    if (input.skipped?.length) {
      out.push(`Left out on purpose: ${input.skipped.map((x) => `${x.name} (${x.why})`).join("; ")}.`);
    }
    const inBundle = new Set(input.lines?.map((l) => l.productId) ?? input.items.map((i) => i.productId));
    // Only suggest what suits their kind of business: every product lists the segments it is meant for.
    const segment = input.answers?.businessType
      ? segmentFor({ businessType: input.answers.businessType, sites: input.answers.sites ?? input.profile.sites })
      : null;
    const candidates = catalogue.filter((p) => !inBundle.has(p.id) && checkProductEligibility(p, input.profile!).eligible);
    const fits = candidates.filter((p) => !segment || p.targetSegments.includes(segment));
    const notForThem = candidates.filter((p) => segment && !p.targetSegments.includes(segment));
    if (segment) out.push(`Their kind of business: ${SEGMENT_LABELS[segment].en}.`);
    out.push(
      fits.length
        ? `Other products that suit their kind of business and can be added from "More you can add": ${fits
            .slice(0, 8)
            .map((p) => `${p.name} ₹${p.priceMin}–${p.priceMax}/month before GST (${p.description.split(/; |\. /)[0]})`)
            .join("; ")}.`
        : "Nothing else in the catalogue suits their kind of business beyond what is already in the bundle.",
    );
    if (notForThem.length) {
      out.push(
        `Made for other kinds of business, so do not suggest them (if asked by name, explain who they are for): ${notForThem
          .map((p) => `${p.name} (for ${p.targetSegments.map((x) => SEGMENT_LABELS[x as SegmentCode].en).join(", ")})`)
          .join("; ")}.`,
      );
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

  const order = input.orderId ? await getOrder(input.orderId) : undefined;
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

/** `context` is ownerContext(input) and `catalogue` is catalogueBrief(), worked out once per turn. */
export function assistantPrompt(input: AssistantInput, context: string, catalogue: string): string {
  const L = languageOf(input.lang);
  const actions = input.actions.length ? input.actions.join(", ") : "none";
  return `You are the owner's personal assistant inside the UdyamSaathi app, where Indian small-business owners buy Accel Business internet, phone and IT services. You are both an advisor (what to choose for their business, and why) and a guide (where things are in the app). You know every screen, their own bundle and their order.

How to answer:
- First work out what they want. "What should I choose / do I need X / is this too much / what can I skip" is a request for ADVICE: give your own clear recommendation for THEIR business, using "Why each product was suggested", which items are essential vs optional, and the totals given. Say which to keep and which optional ones they could switch off or add, with the reason in their terms. If you suggest switching something off, name it explicitly; give a new total only if "common choices" has that exact combination. Never call an optional add-on essential. Suggest extra products ONLY from "Other products that suit their kind of business", and only when they fit what this owner said they need; if none fit, say the bundle already covers them. Name at most 5 products; a short "•" list is fine. Then say where to do it (the switches on the ${screenName("quote", input.labels)} screen) and offer the button.
- "Where / how do I…" is a request for DIRECTIONS: name the screen and the exact button.
- Never repeat an earlier answer. If they ask again in other words, your last answer did not help: answer the new question directly and differently.
- Call screens only by their on-screen names (quoted in the guide), never internal words like "recommendation" or "step 1".

Rules:
- Reply in ${L.english}, in the ${L.script} script, in simple everyday words. Keep product names, ₹ amounts and GST/KYC/UPI/WhatsApp in English.
- Keep it short: at most 5 short sentences or a short list. Be specific and personal; no generic marketing lines.
- State a product's requirements (GST, staff, sites, city, another line) only as written in its catalogue line; if the line says nothing, it has no such requirement.
- Use ONLY the app guide, the owner's details, the catalogue and the FAQ below. Never invent screens, buttons, products, prices, dates or policies. If you don't know, say so and offer a partner call.
- For their total, products or order status, use the numbers in "Owner right now" exactly. Never calculate a price yourself; if the number you need is not given, say the Quote screen shows it instantly.
- You cannot change anything yourself. You may offer ONE button by setting "action" to one of: ${actions}. Only offer it when it takes them where they need to go; otherwise null. Don't mention action names in the reply.
- Stay on topic: the app, their business connection and Accel services. Politely decline anything else.
- If they want a person, or ask something only a partner can do, set "action" to "talk_to_person" if available.

App guide:
${appGuide(input.labels)}

Owner right now:
${context}

Catalogue (₹ per month before GST, "12m min" = 12-month minimum contract, "~3d install" = installed in about 3 days):
${catalogue}

FAQ:${FAQ}

Respond with JSON only: {"reply": string, "action": one of [${ACTION_IDS.join(", ")}] or null}`;
}

export async function assistantChat(input: AssistantInput): Promise<AssistantResult> {
  const [context, brief] = await Promise.all([ownerContext(input), catalogueBrief()]);
  const history = input.history.slice(-10).map((t) => ({ ...t, content: t.content.slice(0, 600) }));
  const last = [...history].reverse().find((t) => t.role === "user")?.content ?? "";
  const allowed = (a: unknown): ActionId | null => (isActionId(a) && input.actions.includes(a) ? a : null);

  const transcript = history.map((t) => `${t.role === "user" ? "Owner" : "Assistant"}: ${t.content}`).join("\n");
  const previous = [...history].reverse().find((t) => t.role === "assistant")?.content ?? "";
  const ask = async (extra = "") =>
    parseJsonReply<{ reply?: unknown; action?: unknown }>(
      await complete({
        system: assistantPrompt(input, context, brief),
        user: `Conversation so far:\n${transcript}\n\nReply to the owner's last message.${extra}`,
        json: true,
        timeoutMs: 15_000,
      }),
    );

  let raw = await ask();
  // Smaller models sometimes repeat themselves when the owner rephrases; ask once more.
  if (raw && typeof raw.reply === "string" && previous && similarity(raw.reply, previous) > 0.7) {
    raw =
      (await ask(
        "\nYour previous answer did not help them: it is repeated below. Answer their last message directly with something new and useful." +
          `\nPrevious answer: ${previous}`,
      )) ?? raw;
  }

  // Every ₹ amount must come from the data we gave the model, never its own arithmetic.
  const known = new Set([...rupeeAmounts(context), ...rupeeAmounts(brief)]);
  const invented = (r: string) => rupeeAmounts(r).filter((n) => !known.has(n));
  if (raw && typeof raw.reply === "string" && invented(raw.reply).length) {
    const bad = invented(raw.reply).map((n) => formatInr(n)).join(", ");
    raw =
      (await ask(
        `\nYour draft stated amounts that are not in the data: ${bad}. Do not calculate prices. ` +
          "Use only totals given under \"Owner right now\" or catalogue prices; otherwise say the screen shows the exact price instantly." +
          `\nDraft: ${raw.reply}`,
      )) ?? raw;
  }
  if (raw && typeof raw.reply === "string") {
    raw.reply = dropSentencesWith(raw.reply, (part) => invented(part).length > 0);
  }

  if (raw && typeof raw.reply === "string" && raw.reply.trim()) {
    return { reply: raw.reply.trim().slice(0, 900), action: allowed(raw.action), source: "llm" };
  }

  // No LLM: advice straight from the bundle, or directions from the app guide.
  const advice = ADVICE.test(last) ? await adviceFromBundle(input) : null;
  if (advice) return { reply: advice, action: allowed("go_quote"), source: "rules" };
  const howTo = matchHowTo(last);
  return { reply: howTo?.answer ?? GENERIC_HELP, action: allowed(howTo?.action), source: "rules" };
}


/** Share of words two replies have in common (0–1). */
export function similarity(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().split(/[\s,.!?।"']+/u).filter((w) => w.length > 1));
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let both = 0;
  A.forEach((w) => B.has(w) && both++);
  return both / Math.min(A.size, B.size);
}

const ADVICE = /choose|select|pick|should i|do i need|recommend|suggest|worth|skip|too (much|expensive)|chun|chuz|लूँ|लूं|लेना|चुन|चूज|ज़रूरत|जरूरत|सुझाव|क्या.?क्या/iu;

/** Rule-based advice for "what should I choose", built from why each product was suggested. */
export async function adviceFromBundle(input: AssistantInput): Promise<Text | null> {
  const catalogue = new Map((await getCatalogue()).map((p) => [p.id, p]));
  const lines = (input.lines ?? []).filter((l) => catalogue.has(l.productId));
  if (!lines.length) return null;
  const name = (l: (typeof lines)[number]) => catalogue.get(l.productId)!.name;
  const essentials = lines.filter((l) => l.core).map(name);
  const optional = lines.filter((l) => !l.core).map(name);
  const list = (xs: string[]) => xs.join(", ");
  return {
    en:
      `For your business, keep the essentials: ${list(essentials) || "none"}.` +
      (optional.length ? ` These are optional: ${list(optional)}. Each card says why it was suggested; switch off any you don't need on the Quote screen and the price updates instantly.` : ""),
    hi:
      `आपके बिज़नेस के लिए ये ज़रूरी हैं, इन्हें रखें: ${list(essentials) || "कोई नहीं"}।` +
      (optional.length ? ` ये वैकल्पिक हैं: ${list(optional)}। हर कार्ड पर लिखा है कि इसे क्यों सुझाया गया; जो ज़रूरी न हो उसे कीमत वाली स्क्रीन पर बंद करें, कीमत तुरंत बदल जाएगी।` : ""),
  };
}

const DIGIT_ZEROS = [0x30, 0x660, 0x6f0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0x1c50, 0xabf0];
/** Indian-script digits to ASCII, so "₹९,०२२" is checked like "₹9,022". */
function asciiDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, (d) => {
    const cp = d.codePointAt(0)!;
    const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9);
    return zero === undefined ? d : String(cp - zero);
  });
}

/** Every rupee amount in a text, e.g. "₹9,022", "₹999–1199", "₹8k–12k", "Rs 500". */
export function rupeeAmounts(text: string): number[] {
  const out: number[] = [];
  const num = (n: string, k?: string) => Math.round(Number(n.replace(/,/g, "")) * (k ? 1000 : 1));
  const re = /(?:₹|rs\.?|inr)\s?([\d,]+(?:\.\d+)?)(k)?(?:\s?[–-]\s?(?:₹\s?)?([\d,]+(?:\.\d+)?)(k)?)?/gi;
  for (const m of asciiDigits(text).matchAll(re)) {
    out.push(num(m[1], m[2]));
    if (m[3]) out.push(num(m[3], m[4]));
  }
  return out.filter((n) => Number.isFinite(n) && n > 0);
}

/** Remove sentences (or list lines) that fail a check, keeping the rest of the reply. */
export function dropSentencesWith(text: string, bad: (part: string) => boolean): string {
  return text
    .split("\n")
    .map((line) =>
      line
        .split(/(?<=[.!?।])\s+/u)
        .filter((part) => !bad(part))
        .join(" "),
    )
    .filter((line, i, all) => line.trim() || (i > 0 && all[i - 1].trim()))
    .join("\n")
    .trim();
}
