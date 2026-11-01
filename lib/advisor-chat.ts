import { CITY_TIERS, type AdvisorAnswers } from "./advisor";
import { ALL_TYPES, INTERNET, NEEDS, QUESTION_TEXT, cleanAnswers, parseByKeywords, type PartialAnswers, type QuestionKey } from "./advisor-parse";
import { getCatalogue } from "./catalogue";
import { LANGUAGES, isLangCode, languageOf, type LangCode } from "./languages";
import { complete, parseJsonReply } from "./llm";

/**
 * The conversational layer of the advisor. The LLM talks to the owner (answers their
 * questions, picks up facts, asks for what is missing) but never chooses products or
 * prices: once every fact is known, the rule-based recommender takes over.
 */

export const QUESTION_ORDER: QuestionKey[] = ["businessType", "city", "employees", "sites", "currentInternet", "needs", "hasGstin"];

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  /** The advisor's reply in the owner's language, or null to use the scripted question. */
  reply: string | null;
  /** Facts picked up from this message. */
  updates: PartialAnswers;
  /** The next fact still needed, or null when the bundle can be recommended. */
  next: QuestionKey | null;
  /** The owner wants a person (or asked something only a person can answer). */
  handoff: boolean;
  /** Which fact the reply asks for, so the app can show matching buttons. */
  asking: QuestionKey | null;
  /** The owner asked to switch the app's language. */
  language: LangCode | null;
  source: "llm" | "rules";
}

export function missing(answers: PartialAnswers): QuestionKey[] {
  return QUESTION_ORDER.filter((k) => answers[k] === undefined);
}

/** Compact catalogue for the prompt, built from the live (admin-editable) catalogue. Kept short: every turn pays for it. */
function catalogueBrief(): string {
  const k = (n: number) => (n >= 1000 && n % 100 === 0 ? `${n / 1000}k` : String(n));
  return getCatalogue()
    .map((p) => {
      const rules = [
        p.cityTiers.length === 1 ? `tier-${p.cityTiers[0]} cities` : null,
        p.minEmployees > 1 ? `${p.minEmployees}+ staff` : null,
        p.minSites > 1 ? `${p.minSites}+ sites` : null,
        p.requiresGstin ? "needs active GST" : null,
        p.requiresOneOf.length ? "needs an Accel internet line" : null,
      ].filter(Boolean);
      return `- ${p.name}: ${p.description.split(/; |\. /)[0].replace(/\.$/, "")}. ₹${k(p.priceMin)}–${k(p.priceMax)}/mo${p.unit && p.unit !== "per connection" ? ` ${p.unit}` : ""}` +
        `${p.setupFee ? `, setup ₹${k(p.setupFee)}` : ""}, ${p.minContractMonths}m min, ~${p.installDays}d install${rules.length ? `; ${rules.join(", ")}` : ""}`;
    })
    .join("\n");
}

const FAQ = `
- Everything comes as one bundle with one monthly bill and one support number (1800-000-0000).
- Price depends on the bundle: 1 product is at the top of its range, 2–3 products mid-range, 4 or more at the lowest price. GST of 18% is added. Setup fees are paid once.
- Each product has a minimum contract; the bundle's contract is the longest of them.
- After ordering, the owner sees installation and activation live on an order tracker, so they don't need to call support.
- KYC needs: GST certificate, Udyam certificate, an electricity bill from the last 90 days as address proof, and the ID of the person signing. Photos are read on the phone; only the text is checked. It usually takes minutes.
- Without an active GST registration the owner can still buy most products; WhatsApp Business, SMS packs, toll-free numbers, leased lines, SD-WAN, cloud telephony, managed firewall and machine IoT need GST.
- Udyam registration is free at udyamregistration.gov.in; GST at gst.gov.in.
- Personal data is used only for KYC and activation; consent can be withdrawn.
- Catalogue shorthand: "12m min" = 12-month minimum contract, "~3d install" = installed in about 3 days.
- The app works in English and 22 Indian languages. If the owner asks to switch language, set "language" to its code and reply in that language.
- For anything not covered here (exact coverage at an address, custom discounts, early-exit fees, complaints about another provider), do not guess: offer a call from a local Accel partner and set "handoff": true.`;

export function systemPrompt(lang: LangCode, answers: PartialAnswers, pending: QuestionKey | null): string {
  const L = languageOf(lang);
  const known = Object.entries(answers)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("; ");
  return `You are the Accel Business advisor in the UdyamSaathi app, helping an Indian small-business owner pick internet, phone and IT services.

Your job each turn:
1. Pick up any facts the owner states about their business (see "facts" below).
2. If they asked a question, answer it briefly and accurately using ONLY the catalogue and FAQ below.
3. Then ask for the next missing fact, in natural words.

Rules:
- Reply in ${L.english}, in the ${L.script} script, in simple words a shopkeeper uses. Keep product names, ₹ amounts and GST/KYC/UPI/WhatsApp in English.
- At most 3 short sentences. Warm, plain, no jargon.
- Never invent products, prices, discounts or policies. Quote prices only as the ranges in the catalogue.
- Before saying whether a product suits them, check its catalogue line. "needs active GST" means it is NOT available without GST registration; say so plainly.
- Only put a fact in "updates" if the owner clearly said it. Asking about a product does not mean they use it or want it. When unsure, leave it out and ask.
- Never say internal labels such as "Other manufacturing unit" or field names to the owner; describe their business in their own words.
- After answering, always end your reply by asking for the next fact listed below, unless all facts are known.
- Do not recommend a final bundle yourself; once all facts are known, the app builds the bundle and the exact price.
- Stay on topic. If asked about something unrelated, say politely that you can only help with their business connection and services.
- If they want to talk to a person, set "handoff": true and say a local partner will call them.

Facts to collect (key: allowed values):
- businessType: one of ${JSON.stringify(ALL_TYPES)}. If nothing matches exactly, pick the closest one, or the "Other ..." type of the right kind (a factory or workshop is "Other manufacturing unit", even if it also trades).
- city: one of ${JSON.stringify(Object.keys(CITY_TIERS))} or another Indian city as written
- employees: number of people working, sites: number of shops/branches/locations
- currentInternet: one of ${JSON.stringify(INTERNET)}
- needs: list from ${JSON.stringify(NEEDS)}
- hasGstin: true/false (is the business GST registered)

Already known: ${known || "nothing yet"}.
Next fact to ask for: ${pending ?? "none, all known"}${pending ? ` ("${QUESTION_TEXT[pending]}")` : ""}.

Catalogue:
${catalogueBrief()}

FAQ:${FAQ}

Language codes: ${LANGUAGES.map((l) => `${l.code}=${l.english}`).join(" ")}.

Respond with JSON only:
{"reply": string, "updates": {only facts stated in the owner's LAST message}, "asking": the fact key your reply asks for, or null, "language": a language code if the owner asked to switch language, else null, "handoff": boolean}`;
}

export async function advisorChat(args: {
  history: ChatTurn[];
  answers: PartialAnswers;
  lang: LangCode;
  pending: QuestionKey | null;
}): Promise<ChatResult> {
  const history = args.history.slice(-12).map((t) => ({ ...t, content: t.content.slice(0, 600) }));
  const last = [...history].reverse().find((t) => t.role === "user")?.content ?? "";
  const rules = parseByKeywords(last, args.pending ?? undefined);

  const transcript = history.map((t) => `${t.role === "user" ? "Owner" : "Advisor"}: ${t.content}`).join("\n");
  const raw = parseJsonReply<{ reply?: unknown; updates?: Record<string, unknown>; handoff?: unknown; asking?: unknown; language?: unknown }>(
    await complete({
      system: systemPrompt(args.lang, args.answers, args.pending),
      user: `Conversation so far:\n${transcript}\n\nReply to the owner's last message.`,
      json: true,
      timeoutMs: 22_000,
    }),
  );

  if (!raw || typeof raw.reply !== "string" || !raw.reply.trim()) {
    // No LLM (or it failed): keyword understanding plus the scripted next question.
    const merged = { ...args.answers, ...rules };
    return { reply: null, updates: rules, next: missing(merged)[0] ?? null, handoff: false, asking: null, language: null, source: "rules" };
  }

  const updates = { ...rules, ...cleanAnswers(raw.updates ?? {}) };
  const merged: PartialAnswers = { ...args.answers, ...updates };
  const reply = raw.reply.trim().slice(0, 800);
  const next = missing(merged)[0] ?? null;
  const asking = QUESTION_ORDER.includes(raw.asking as QuestionKey) ? (raw.asking as QuestionKey) : null;
  return {
    reply,
    updates,
    next,
    handoff: raw.handoff === true,
    // Trust "asking" only if the reply really asks something; otherwise the app shows
    // the scripted question (with its buttons) after the reply.
    asking: asking && /[?？؟]/.test(reply) ? asking : null,
    language: isLangCode(raw.language) ? raw.language : null,
    source: "llm",
  };
}

export type { AdvisorAnswers };
