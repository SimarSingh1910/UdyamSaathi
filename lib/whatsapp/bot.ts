import { readFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_NEEDS, segmentFor, type Need } from "../advisor";
import { FAQ, advisorChat, catalogueBrief, missing } from "../advisor-chat";
import { INTERNET, type QuestionKey } from "../advisor-parse";
import { dropSentencesWith, ownerContext, rupeeAmounts } from "../assistant";
import { getCatalogue } from "../catalogue";
import { INTERNET_LABELS, NEED_LABELS, STRINGS, formatInr, type Text } from "../i18n";
import { blockingChecks, checkKycDocs, DOC_TYPES } from "../kyc/check";
import { detectDocType, type DocType } from "../kyc/parse";
import { LANGUAGES, isLangCode, languageOf, type LangCode } from "../languages";
import { complete } from "../llm";
import { STATUS_LABEL, normalizePhone } from "../order-flow";
import { sttEnabled, transcribe } from "../stt";
import { placeOrder } from "../orders";
import { buildQuote } from "../quote";
import { buildRecommendation, completeAnswers } from "../recommendation";
import { keyedHash } from "../security/hash";
import { createRequest, deleteWaSession, getOrder, getWaSession, saveWaSession } from "../store";
import { translate } from "../translate";
import {
  checkCode,
  simulateMissedCall,
  startVerification,
  verificationStatus,
  verifyMethods,
  missedCallNumber,
} from "../verify/phone";
import { downloadMedia, markRead, sendMessage } from "./client";
import { WA } from "./copy";
import { readImage } from "./ocr";
import type { WaSession } from "./types";

/**
 * The /start journey as a WhatsApp conversation: advisor, bundle, KYC, contact and
 * order. It uses the same rules, quote engine, KYC checks and order store as the
 * web app; only the screens are replaced by messages, buttons and lists.
 */

export interface Incoming {
  /** WhatsApp message id. */
  id: string;
  /** WhatsApp id of the sender: country code and number, digits only. */
  from: string;
  profileName?: string;
  /** Typed text, or the title of the tapped button or list row. */
  text?: string;
  /** Id of the tapped button or list row. */
  replyId?: string;
  media?: { id: string; mime: string };
}

/** A conversation idle this long starts afresh. */
const SESSION_TTL_MS = 7 * 86_400_000;
const KYC_DOCS_TTL_MS = 30 * 60_000;

export const sessionKey = (waId: string) => keyedHash("wa", waId);

// ---- Copy in the owner's language ---------------------------------------------

/** A plain string is already in the owner's language; an object is English (and maybe Hindi) to translate. */
type Copy = string | { en: string; hi?: string };
type Vars = Record<string, string | number>;

async function loc(lang: LangCode, c: Copy, vars: Vars = {}): Promise<string> {
  let s: string;
  if (typeof c === "string") s = c;
  else if (lang === "en") s = c.en;
  else if (lang === "hi" && c.hi) s = c.hi;
  else {
    const got = (await translate(lang, [c.en]))[c.en];
    // Placeholders must survive translation; otherwise English is safer.
    s = got && Object.keys(vars).every((k) => got.includes(`{${k}}`)) ? got : c.en;
  }
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

class Chat {
  deleted = false;
  constructor(public s: WaSession) {}

  t(c: Copy, vars?: Vars) {
    return loc(this.s.lang, c, vars);
  }

  async say(c: Copy, vars?: Vars) {
    await sendMessage(this.s.waId, { type: "text", text: await this.t(c, vars) });
  }

  async buttons(c: Copy, buttons: [id: string, title: Copy][], vars?: Vars) {
    await sendMessage(this.s.waId, {
      type: "buttons",
      text: await this.t(c, vars),
      buttons: await Promise.all(buttons.map(async ([id, title]) => ({ id, title: await this.t(title) }))),
    });
  }

  async list(c: Copy, button: Copy, rows: { id: string; title: Copy; description?: Copy }[]) {
    await sendMessage(this.s.waId, {
      type: "list",
      text: await this.t(c),
      button: await this.t(button),
      rows: await Promise.all(
        rows.map(async (r) => ({
          id: r.id,
          title: await this.t(r.title),
          description: r.description ? await this.t(r.description) : undefined,
        })),
      ),
    });
  }
}

const fmtPhone = (p: string) => `${p.slice(0, 5)} ${p.slice(5)}`;
const ownPhone = (s: WaSession) => normalizePhone(s.waId);

// ---- Entry points --------------------------------------------------------------

// Messages from one person are handled one at a time, in order.
const chains = new Map<string, Promise<void>>();
function serial(key: string, fn: () => Promise<void>): Promise<void> {
  const next = (chains.get(key) ?? Promise.resolve()).then(fn).catch((e) => console.error("[whatsapp] handler failed", e));
  chains.set(key, next);
  void next.finally(() => chains.get(key) === next && chains.delete(key));
  return next;
}

// KYC document text lives in memory only, for half an hour at most.
const kycDocs = new Map<string, { docs: Partial<Record<DocType, string>>; at: number }>();
function docsFor(key: string): Partial<Record<DocType, string>> {
  let d = kycDocs.get(key);
  if (!d || Date.now() - d.at > KYC_DOCS_TTL_MS) {
    d = { docs: {}, at: Date.now() };
    kycDocs.set(key, d);
  }
  d.at = Date.now();
  return d.docs;
}

function newSession(key: string, waId: string, old?: WaSession): WaSession {
  const now = Date.now();
  return {
    key,
    waId,
    lang: old?.lang ?? "en",
    step: "language",
    history: [],
    answers: {},
    pending: null,
    orderIds: old?.orderIds ?? [],
    seen: old?.seen ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

export function handleIncoming(msg: Incoming): Promise<void> {
  const key = sessionKey(msg.from);
  return serial(key, async () => {
    const stored = await getWaSession(key);
    if (stored?.seen.includes(msg.id)) return;
    const fresh = !stored || Date.now() - stored.updatedAt > SESSION_TTL_MS;
    const s = fresh ? newSession(key, msg.from, stored) : stored;
    s.waId = msg.from;
    s.profileName = msg.profileName?.slice(0, 80) ?? s.profileName;
    s.seen = [...s.seen.slice(-49), msg.id];
    void markRead(msg.id);

    const chat = new Chat(s);
    try {
      await route(chat, msg, fresh);
    } catch (e) {
      console.error("[whatsapp] turn failed", e);
      await chat.say(STRINGS.somethingWrong);
    }
    if (!chat.deleted) await saveWaSession(chat.s);
  });
}

/** A missed call came in for a chat that was waiting on it. */
export function onPhoneVerified(key: string): Promise<void> {
  return serial(key, async () => {
    const s = await getWaSession(key);
    if (!s || s.step !== "phone_missed" || !s.verificationId) return;
    if ((await verificationStatus(s.verificationId)) !== "verified") return;
    const chat = new Chat(s);
    await phoneConfirmed(chat);
    await saveWaSession(chat.s);
  });
}

// ---- Routing -----------------------------------------------------------------

const WANTS_PERSON = /\b(agent|human|real person|talk to (a |some)?(person|human|one)|call me back)\b|किसी व्यक्ति|इंसान से/i;

async function route(chat: Chat, msg: Incoming, fresh: boolean): Promise<void> {
  const s = chat.s;
  // Voice notes are common: treat a transcribed one like typed text.
  if (msg.media?.mime.startsWith("audio/")) {
    const heard = await hear(msg.media, s.lang);
    if (!heard) return chat.say(STRINGS.micError);
    msg = { ...msg, media: undefined, text: heard };
  }
  const text = (msg.text ?? "").trim();
  const id = msg.replyId;

  if (!id) {
    if (/^(stop|unsubscribe)$/i.test(text)) return stop(chat);
    if (fresh) return askLanguage(chat);
    if (/^(start over|restart|reset)$|^फिर से शुरू/i.test(text)) return startOver(chat);
    if (/^(language|change language|bhasha|भाषा)$/i.test(text)) return askLanguage(chat);
    if (/^(status|track|order status)$/i.test(text)) return showStatus(chat);
    if (/^(help|menu)$/i.test(text)) return showMenu(chat);
    if (WANTS_PERSON.test(text)) return handoff(chat, text);
  } else if (fresh) {
    return askLanguage(chat);
  }

  if (id === "start_over") return startOver(chat);
  if (id === "handoff") return handoff(chat);
  if (id === "status") return showStatus(chat);
  if (id?.startsWith("lang:")) return setLanguage(chat, id.slice(5));
  if (id?.startsWith("verify:") || id?.startsWith("phone:")) return phoneAction(chat, id);

  if (msg.media) return s.step === "kyc" ? kycMedia(chat, msg.media) : chat.say(WA.kycNotDuringStep);

  switch (s.step) {
    case "language": {
      const lang = matchLanguage(text);
      if (lang) return setLanguage(chat, lang);
      // They skipped the question and started describing the business: carry on in English or Hindi.
      if (text.length > 15) {
        s.lang = /[ऀ-ॿ]/.test(text) ? "hi" : "en";
        await startAdvisor(chat, false);
        return advisorTurn(chat, msg, text);
      }
      return chat.buttons(WA.languageUnknown, LANGUAGE_BUTTONS);
    }
    case "advisor":
      return advisorTurn(chat, msg, text);
    case "bundle":
      if (id === "bundle:continue") return continueFromBundle(chat);
      if (id === "bundle:edit") return showEdit(chat);
      return answerThenReprompt(chat, text);
    case "edit":
      if (id?.startsWith("toggle:")) {
        const line = s.cart?.find((l) => l.productId === id.slice(7));
        if (line) line.on = !line.on;
        return showEdit(chat);
      }
      if (id === "edit:done") return showBundle(chat);
      return answerThenReprompt(chat, text);
    case "consent":
      if (id === "consent:yes") return startKyc(chat);
      if (id === "consent:no") return chat.buttons(WA.consentDeclined, [["handoff", WA.talkToPerson], ["consent:yes", WA.agree]]);
      return answerThenReprompt(chat, text);
    case "kyc": {
      if (id === "kyc:check") return runKyc(chat);
      const sample = text.match(/^sample\s*k?(\d{1,2})$/i);
      if (sample) return kycSample(chat, `K${sample[1].padStart(2, "0")}`);
      return answerThenReprompt(chat, text);
    }
    case "name":
      if (id === "name:use" && s.kyc?.signatory) s.contactName = s.kyc.signatory;
      else if (text.length >= 2) s.contactName = text.slice(0, 80);
      else return askName(chat);
      return askCallPhone(chat);
    case "phone_choice":
    case "phone_enter":
      return phoneEntered(chat, text);
    case "phone_code":
      return codeEntered(chat, text);
    case "phone_missed":
      return waitingForCall(chat);
    case "phone_method":
      return askMethod(chat);
    case "done":
      return answerThenReprompt(chat, text);
  }
}

async function hear(media: { id: string; mime: string }, lang: LangCode): Promise<string | null> {
  if (!sttEnabled()) return null;
  const file = await downloadMedia(media.id);
  if (!file) return null;
  return transcribe(new Blob([new Uint8Array(file.data)], { type: file.mime }), lang);
}

/** Shows the current step again: the answer to "what now?". */
async function reprompt(chat: Chat): Promise<void> {
  const s = chat.s;
  switch (s.step) {
    case "language":
      return askLanguage(chat);
    case "advisor":
      return nextQuestion(chat);
    case "bundle":
      return showBundle(chat);
    case "edit":
      return showEdit(chat);
    case "consent":
      return askConsent(chat);
    case "kyc":
      return Object.keys(docsFor(s.key)).length ? afterDocs(chat) : chat.say(WA.kycAsk);
    case "name":
      return askName(chat);
    case "phone_choice":
      return askCallPhone(chat);
    case "phone_enter":
      return chat.say(WA.askPhone);
    case "phone_method":
      return askMethod(chat);
    case "phone_code":
      return chat.buttons(WA.codeSent, [["verify:change", WA.changeMethod]], { phone: fmtPhone(s.pendingPhone ?? "") });
    case "phone_missed":
      return waitingForCall(chat);
    case "done":
      return chat.buttons(WA.doneHelp, [["status", WA.status], ["start_over", STRINGS.startOver], ["handoff", WA.talkToPerson]]);
  }
}

/**
 * Free text outside the advisor is usually a question ("is setup free?"). Answer it
 * from the catalogue and FAQ when an LLM is available, then show the step again.
 */
async function answerThenReprompt(chat: Chat, text: string): Promise<void> {
  if (text.length > 3) {
    const answer = await answerQuestion(chat.s, text);
    if (answer) await chat.say(answer);
  }
  return reprompt(chat);
}

async function answerQuestion(s: WaSession, question: string): Promise<string | null> {
  const L = languageOf(s.lang);
  const brief = await catalogueBrief();
  const context = await ownerContext({
    history: [],
    lang: s.lang,
    screen: s.step === "done" ? "done" : s.step === "kyc" || s.step === "consent" ? "kyc" : "quote",
    labels: {},
    actions: [],
    answers: s.answers,
    profile: s.profile,
    items: cartItems(s),
    kyc: s.kyc ? { checked: true, approved: s.kyc.canOrder, issues: [] } : undefined,
    orderId: s.orderIds.at(-1),
  });
  const reply = await complete({
    system:
      `You are the Accel Business advisor chatting with an Indian small-business owner on WhatsApp. ` +
      `Answer their message in at most 3 short sentences, in ${L.english} (${L.script} script), in plain words. ` +
      `Use ONLY the facts below. Never invent products, prices or policies. If the message is not a question you can answer from these facts, reply exactly NONE.\n\n` +
      `Owner right now:\n${context}\n\nCatalogue:\n${brief}\n\nFAQ:${FAQ}`,
    user: question.slice(0, 600),
    timeoutMs: 15_000,
  });
  if (!reply || /^\s*NONE\s*\.?\s*$/i.test(reply)) return null;
  // Every ₹ amount must come from the data, never the model's arithmetic.
  const known = new Set([...rupeeAmounts(context), ...rupeeAmounts(brief)]);
  const clean = dropSentencesWith(reply.trim(), (part) => rupeeAmounts(part).some((n) => !known.has(n)));
  return clean.trim().slice(0, 900) || null;
}

// ---- Commands ----------------------------------------------------------------

const LANGUAGE_BUTTONS: [string, Copy][] = [
  ["lang:en", "English"],
  ["lang:hi", "हिंदी"],
  ["lang:other", WA.otherLanguage],
];

function matchLanguage(text: string): LangCode | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const hit = LANGUAGES.find(
    (l) => t === l.code || [l.english.toLowerCase(), l.native.toLowerCase()].some((n) => t === n || (t.length <= 30 && t.includes(n))),
  );
  if (hit) return hit.code;
  if (/^(hindi|हिंदी)$/.test(t)) return "hi";
  return null;
}

async function askLanguage(chat: Chat): Promise<void> {
  chat.s.step = "language";
  return chat.buttons(WA.welcome, LANGUAGE_BUTTONS);
}

async function setLanguage(chat: Chat, code: string): Promise<void> {
  if (code === "other") return chat.say(WA.askLanguageName);
  if (!isLangCode(code)) return askLanguage(chat);
  chat.s.lang = code;
  if (chat.s.step === "language") return startAdvisor(chat);
  return reprompt(chat);
}

function resetJourney(s: WaSession) {
  Object.assign(s, {
    step: "advisor",
    history: [],
    answers: {},
    pending: null,
    profile: undefined,
    cart: undefined,
    kyc: undefined,
    contactName: undefined,
    pendingPhone: undefined,
    verificationId: undefined,
  } satisfies Partial<WaSession>);
  kycDocs.delete(s.key);
}

async function startAdvisor(chat: Chat, ask = true): Promise<void> {
  resetJourney(chat.s);
  await chat.say(WA.advisorHello);
  if (ask) await nextQuestion(chat);
}

async function startOver(chat: Chat): Promise<void> {
  return startAdvisor(chat);
}

async function stop(chat: Chat): Promise<void> {
  kycDocs.delete(chat.s.key);
  await chat.say(WA.stopped);
  await deleteWaSession(chat.s.key);
  chat.deleted = true;
}

async function showMenu(chat: Chat): Promise<void> {
  return chat.buttons(WA.menu, [["handoff", WA.talkToPerson], ["start_over", STRINGS.startOver], ["status", WA.status]]);
}

async function showStatus(chat: Chat): Promise<void> {
  const id = chat.s.orderIds.at(-1);
  const o = id ? await getOrder(id) : undefined;
  if (!o) return chat.say(WA.noOrder);
  const latest = o.events.at(-1)?.note ?? STATUS_LABEL[o.status];
  const parts = [
    await chat.t(WA.orderStatus, { id: o.id, status: await chat.t(STATUS_LABEL[o.status]), latest: await chat.t(latest) }),
  ];
  const base = publicBaseUrl();
  if (base) parts.push(await chat.t(WA.trackLink, { link: `${base}/track/${o.id}` }));
  return chat.say(parts.join("\n\n"));
}

async function handoff(chat: Chat, reason?: string): Promise<void> {
  const s = chat.s;
  // The WhatsApp number itself is already proven by WhatsApp.
  const phone = ownPhone(s) ?? s.waId;
  const r = await createRequest({
    kind: "callback",
    contact: { name: s.contactName ?? s.profileName ?? "WhatsApp customer", phone },
    business: { tradeName: s.kyc?.tradeName, businessType: s.answers.businessType, city: s.answers.city },
    reasons: [`Asked on WhatsApp (step: ${s.step})`, ...(reason ? [reason.slice(0, 200)] : [])],
  });
  return chat.say(WA.handoff, { phone: ownPhone(s) ? fmtPhone(phone) : `+${phone}`, id: r.id });
}

const publicBaseUrl = () => process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") || "";

// ---- Advisor -----------------------------------------------------------------

const QUESTION_COPY: Record<QuestionKey, Text> = {
  businessType: STRINGS.qType,
  city: STRINGS.qCity,
  employees: STRINGS.qEmployees,
  sites: STRINGS.qSites,
  currentInternet: STRINGS.qInternet,
  needs: STRINGS.qNeeds,
  hasGstin: STRINGS.qGst,
};

function suggestedNeeds(s: WaSession): Need[] {
  return DEFAULT_NEEDS[segmentFor({ businessType: s.answers.businessType ?? "", sites: s.answers.sites ?? 1 })];
}

/** Asks for one fact, with buttons or a list where the answers are fixed. */
async function ask(chat: Chat, q: QuestionKey, body?: string): Promise<void> {
  const s = chat.s;
  s.pending = q;
  let prompt = body ?? (await chat.t(QUESTION_COPY[q]));
  if (!body && q === "businessType") prompt += `\n_${await chat.t(WA.typeHint)}_`;
  if (!body && q === "needs") {
    const names = await Promise.all(suggestedNeeds(s).map((n) => chat.t(NEED_LABELS[n])));
    prompt = await chat.t(WA.needsAsk, { suggested: names.join(", ") });
  }
  s.history.push({ role: "assistant", content: prompt });

  if (q === "currentInternet") {
    return chat.list(prompt, WA.choose, INTERNET.map((v, i) => ({ id: `ans:currentInternet:${i}`, title: INTERNET_LABELS[v] })));
  }
  if (q === "needs") return chat.buttons(prompt, [["ans:needs:suggested", WA.useSuggested]]);
  if (q === "hasGstin") return chat.buttons(prompt, [["ans:hasGstin:yes", STRINGS.yes], ["ans:hasGstin:no", STRINGS.no]]);
  return chat.say(prompt);
}

async function nextQuestion(chat: Chat): Promise<void> {
  const next = missing(chat.s.answers)[0];
  return next ? ask(chat, next) : recommendBundle(chat);
}

async function advisorTurn(chat: Chat, msg: Incoming, text: string): Promise<void> {
  const s = chat.s;
  const id = msg.replyId;
  if (id?.startsWith("ans:")) {
    const [, key, value] = id.split(":");
    if (key === "currentInternet") s.answers.currentInternet = INTERNET[Number(value)] ?? s.answers.currentInternet;
    if (key === "hasGstin") s.answers.hasGstin = value === "yes";
    if (key === "needs") s.answers.needs = suggestedNeeds(s);
    s.history.push({ role: "user", content: text || value });
    return nextQuestion(chat);
  }
  if (!text) return nextQuestion(chat);

  s.history.push({ role: "user", content: text.slice(0, 600) });
  s.history = s.history.slice(-16);
  const r = await advisorChat({ history: s.history, answers: s.answers, lang: s.lang, pending: s.pending });
  Object.assign(s.answers, r.updates);
  if (r.language) s.lang = r.language;
  if (r.handoff) {
    if (r.reply) await chat.say(r.reply);
    return handoff(chat, text);
  }

  const open = missing(s.answers);
  const next = open[0] ?? null;
  if (r.reply) {
    // The reply already asks for a missing fact: send it with that question's buttons.
    if (r.asking && open.includes(r.asking)) return ask(chat, r.asking, r.reply);
    s.history.push({ role: "assistant", content: r.reply });
    await chat.say(r.reply);
  } else if (next && Object.keys(r.updates).length === 0) {
    await chat.say(STRINGS.notUnderstood);
  }
  return next ? ask(chat, next) : recommendBundle(chat);
}

// ---- Bundle ------------------------------------------------------------------

const cartItems = (s: WaSession) =>
  (s.cart ?? []).filter((l) => l.on && l.quantity > 0).map(({ productId, quantity }) => ({ productId, quantity }));

const currentQuote = async (s: WaSession) => buildQuote(cartItems(s), s.profile!, await getCatalogue());

async function recommendBundle(chat: Chat): Promise<void> {
  const s = chat.s;
  const answers = completeAnswers(s.answers);
  if (!answers) {
    s.answers.businessType = undefined;
    return ask(chat, "businessType");
  }
  await chat.say(STRINGS.thinking);
  const rec = await buildRecommendation(answers);
  s.profile = rec.recommendation.profile;
  s.cart = rec.recommendation.items.map((i) => ({ productId: i.productId, quantity: i.quantity, on: true, why: i.why }));
  s.pending = null;
  await chat.say(rec.pitch ? { en: rec.pitch } : rec.summary);
  return showBundle(chat);
}

async function showBundle(chat: Chat): Promise<void> {
  const s = chat.s;
  s.step = "bundle";
  if (!s.cart || !s.profile) return startOver(chat);
  const quote = await currentQuote(s);
  if (!quote.lines.length) {
    await chat.say(WA.bundleEmpty);
    return showEdit(chat);
  }
  const perMonth = await chat.t(STRINGS.perMonth);
  const lines = await Promise.all(
    quote.lines.map(async (l) => {
      const why = s.cart!.find((c) => c.productId === l.productId)?.why;
      const qty = l.quantity > 1 ? ` × ${l.quantity}` : "";
      return `• *${l.name}*${qty}: ${formatInr(l.monthly)}${perMonth}${why ? `\n   _${await chat.t(why)}_` : ""}`;
    }),
  );
  // Long bundles can pass WhatsApp's 1,024-character limit for button messages, so the list goes first.
  await chat.say([`*${await chat.t(STRINGS.yourBundle)}*`, ...lines].join("\n"));
  return chat.buttons(
    WA.bundleTotals,
    [["bundle:continue", WA.continue], ["bundle:edit", WA.changeBundle], ["start_over", STRINGS.startOver]],
    {
      total: formatInr(quote.monthlyTotal),
      setup: formatInr(quote.setupTotal),
      months: quote.contractMonths,
      days: quote.expectedActivationDays,
    },
  );
}

async function showEdit(chat: Chat): Promise<void> {
  const s = chat.s;
  s.step = "edit";
  const catalogue = await getCatalogue();
  const quote = await currentQuote(s);
  const perMonth = await chat.t(STRINGS.perMonth);
  const rows = (s.cart ?? []).slice(0, 9).map((l) => {
    const name = catalogue.find((p) => p.id === l.productId)?.name ?? l.productId;
    const priced = quote.lines.find((q) => q.productId === l.productId);
    return {
      id: `toggle:${l.productId}`,
      title: `${l.on ? "✅" : "⬜"} ${name}`,
      description: priced ? `${formatInr(priced.monthly)}${perMonth}` : undefined,
    };
  });
  return chat.list(WA.editPrompt, WA.products, [...rows, { id: "edit:done", title: STRINGS.done }]);
}

async function continueFromBundle(chat: Chat): Promise<void> {
  const s = chat.s;
  const quote = await currentQuote(s);
  if (!quote.lines.length) {
    await chat.say(WA.bundleEmpty);
    return showEdit(chat);
  }
  if (!quote.ready) {
    const issues = await Promise.all(quote.issues.map(async (i) => `• ${await chat.t({ en: i.message })}`));
    return chat.buttons(WA.bundleNotReady, [["bundle:edit", WA.changeBundle], ["handoff", WA.talkToPerson]], {
      issues: issues.join("\n"),
    });
  }
  return s.kyc?.canOrder ? askName(chat) : askConsent(chat);
}

// ---- KYC ---------------------------------------------------------------------

const DOC_LABEL: Record<DocType, Text> = {
  gst_certificate: STRINGS.docGst,
  udyam_certificate: STRINGS.docUdyam,
  address_proof: STRINGS.docBill,
  signatory_id: STRINGS.docId,
};

async function askConsent(chat: Chat): Promise<void> {
  chat.s.step = "consent";
  await chat.say(WA.consent);
  return chat.buttons(WA.consentQuestion, [["consent:yes", WA.agree], ["consent:no", WA.notNow]]);
}

async function startKyc(chat: Chat): Promise<void> {
  chat.s.step = "kyc";
  kycDocs.delete(chat.s.key);
  return chat.say(WA.kycAsk);
}

async function kycMedia(chat: Chat, media: { id: string; mime: string }): Promise<void> {
  if (!media.mime.startsWith("image/")) return chat.say(WA.kycNeedPhoto);
  await chat.say(WA.kycReading);
  const file = await downloadMedia(media.id);
  const text = file ? await readImage(file.data).catch(() => null) : null;
  if (!text) return chat.say(WA.kycReadFailed);
  const type = detectDocType(text);
  if (!type) return chat.say(WA.kycUnknownDoc);
  docsFor(chat.s.key)[type] = text;
  await chat.say(WA.kycGot, { doc: await chat.t(DOC_LABEL[type]) });
  return afterDocs(chat);
}

/** Demo: the synthetic specimen applicants that ship with the app. */
async function kycSample(chat: Chat, id: string): Promise<void> {
  const dir = path.join(process.cwd(), "public", "kyc-samples");
  const files = await Promise.all(DOC_TYPES.map((t) => readFile(path.join(dir, `${id}_${t}.png`)).catch(() => null)));
  if (!files.some(Boolean)) return chat.say(WA.kycNoSample, { id });
  await chat.say(WA.kycReading);
  const docs = docsFor(chat.s.key);
  for (const t of DOC_TYPES) delete docs[t];
  const got: string[] = [];
  for (const data of files) {
    if (!data) continue;
    const text = await readImage(data).catch(() => null);
    const type = text ? detectDocType(text) : null;
    if (!text || !type) continue;
    docs[type] = text;
    got.push(await chat.t(DOC_LABEL[type]));
  }
  if (got.length) await chat.say(WA.kycGot, { doc: got.join(", ") });
  return afterDocs(chat);
}

async function afterDocs(chat: Chat): Promise<void> {
  const docs = docsFor(chat.s.key);
  const still = DOC_TYPES.filter((t) => !docs[t]);
  if (!still.length) return runKyc(chat);
  const names = await Promise.all(still.map((t) => chat.t(DOC_LABEL[t])));
  const buttons: [string, Copy][] = [["handoff", WA.talkToPerson]];
  if (still.length < DOC_TYPES.length) buttons.unshift(["kyc:check", WA.checkNow]);
  return chat.buttons(WA.kycStill, buttons, { docs: names.join(", ") });
}

const ICON = { pass: "✅", warn: "⚠️", fail: "❌" } as const;

async function runKyc(chat: Chat): Promise<void> {
  const s = chat.s;
  const docs = docsFor(s.key);
  await chat.say(STRINGS.checking);
  const r = checkKycDocs(Object.entries(docs).map(([slot, text]) => ({ slot: slot as DocType, text: text! })));
  const notes = await Promise.all(
    r.checks.filter((c) => c.status !== "pass").map(async (c) => `${ICON[c.status]} ${await chat.t(c.message)}`),
  );

  if (blockingChecks(r).length) {
    await chat.say([`*${await chat.t(STRINGS.kycNeedsAction)}*`, ...notes].join("\n"));
    return chat.buttons(WA.kycFixHint, [["handoff", WA.talkToPerson]]);
  }

  s.kyc = {
    canOrder: true,
    gstinUsable: r.gstinUsable,
    tradeName: r.business?.tradeName,
    legalName: r.business?.legalName,
    gstinMasked: r.extracted.gstin,
    signatory: r.extracted.signatory,
  };
  kycDocs.delete(s.key);
  await chat.say([`✅ *${await chat.t(STRINGS.kycApproved)}*`, ...notes].join("\n"));

  if (!r.gstinUsable && s.cart && s.profile) {
    // GSTIN can't be used: drop products that need one and price the rest without it.
    const needsGst = new Set((await getCatalogue()).filter((p) => p.requiresGstin).map((p) => p.id));
    const before = s.cart.length;
    s.cart = s.cart.filter((l) => !needsGst.has(l.productId));
    s.profile = { ...s.profile, hasActiveGstin: false };
    const quote = await currentQuote(s);
    if (s.cart.length < before) await chat.say(WA.gstDropped, { total: formatInr(quote.monthlyTotal) });
    if (!quote.ready || !quote.lines.length) return showBundle(chat);
  }
  return askName(chat);
}

// ---- Contact and phone verification ----------------------------------------------

async function askName(chat: Chat): Promise<void> {
  const s = chat.s;
  s.step = "name";
  if (s.kyc?.signatory) return chat.buttons(WA.askNameKnown, [["name:use", WA.useThisName]], { name: s.kyc.signatory });
  return chat.say(WA.askName);
}

async function askCallPhone(chat: Chat): Promise<void> {
  const s = chat.s;
  const own = ownPhone(s);
  if (!own) {
    s.step = "phone_enter";
    return chat.say(WA.askPhone);
  }
  s.step = "phone_choice";
  return chat.buttons(WA.askCallThis, [["phone:own", WA.thisNumber], ["phone:other", WA.anotherNumber]], { phone: fmtPhone(own) });
}

async function phoneEntered(chat: Chat, text: string): Promise<void> {
  const s = chat.s;
  const phone = normalizePhone(text);
  if (!phone) {
    s.step = "phone_enter";
    return chat.say(STRINGS.invalidMobile);
  }
  if (phone === ownPhone(s)) return finishOrder(chat, phone);
  s.pendingPhone = phone;
  return askMethod(chat);
}

async function askMethod(chat: Chat): Promise<void> {
  const s = chat.s;
  s.step = "phone_method";
  s.verificationId = undefined;
  const methods = verifyMethods();
  const buttons: [string, Copy][] = [];
  if (methods.whatsapp !== "off") buttons.push(["verify:whatsapp", WA.methodWhatsapp]);
  if (methods.missed_call !== "off") buttons.push(["verify:missed_call", WA.methodMissedCall]);
  if (ownPhone(s)) buttons.push(["phone:own", WA.thisNumber]);
  if (!buttons.length) return chat.say(WA.verifyUnavailable);
  return chat.buttons(WA.askMethod, buttons, { phone: fmtPhone(s.pendingPhone ?? "") });
}

async function phoneAction(chat: Chat, id: string): Promise<void> {
  const s = chat.s;
  const own = ownPhone(s);
  if (id === "phone:own" && own) return finishOrder(chat, own);
  if (id === "phone:other") {
    s.step = "phone_enter";
    return chat.say(WA.askPhone);
  }
  if (!s.pendingPhone) return reprompt(chat);
  if (id === "verify:change") return askMethod(chat);
  if (id === "verify:simulate" && s.verificationId) {
    if (await simulateMissedCall(s.verificationId)) return phoneConfirmed(chat);
    return askMethod(chat);
  }
  if (id === "verify:whatsapp" || id === "verify:missed_call") {
    return startPhoneCheck(chat, id === "verify:whatsapp" ? "whatsapp" : "missed_call");
  }
  return reprompt(chat);
}

async function startPhoneCheck(chat: Chat, method: "whatsapp" | "missed_call"): Promise<void> {
  const s = chat.s;
  const phone = s.pendingPhone!;
  const r = await startVerification({ phone, method, waSession: s.key });
  if (!r.ok) {
    if (r.error === "rate_limited") {
      return chat.buttons(WA.rateLimited, [["phone:other", WA.anotherNumber], ...(ownPhone(s) ? [["phone:own", WA.thisNumber] as [string, Copy]] : [])]);
    }
    await chat.say(r.error === "send_failed" ? WA.sendFailed : WA.verifyUnavailable);
    return askMethod(chat);
  }
  s.verificationId = r.id;
  const vars = { phone: fmtPhone(phone), number: r.callNumber ?? "", code: r.demoCode ?? "" };
  if (method === "whatsapp") {
    s.step = "phone_code";
    const text = [await chat.t(WA.codeSent, vars), ...(r.demoCode ? [await chat.t(WA.demoCode, vars)] : [])].join("\n\n");
    return chat.buttons(text, [["verify:change", WA.changeMethod]]);
  }
  s.step = "phone_missed";
  const text = [await chat.t(WA.missedCallAsk, vars), ...(r.demo ? [await chat.t(WA.demoMissedCall)] : [])].join("\n\n");
  const buttons: [string, Copy][] = [["verify:change", WA.changeMethod]];
  if (r.demo) buttons.unshift(["verify:simulate", WA.simulateCall]);
  return chat.buttons(text, buttons);
}

async function codeEntered(chat: Chat, text: string): Promise<void> {
  const s = chat.s;
  if (!s.verificationId) return askMethod(chat);
  const r = await checkCode(s.verificationId, text);
  if (r.ok) return phoneConfirmed(chat);
  if (r.error === "wrong_code") return chat.buttons(WA.wrongCode, [["verify:change", WA.changeMethod]]);
  await chat.say(r.error === "too_many" ? WA.tooManyTries : WA.codeExpired);
  return askMethod(chat);
}

async function waitingForCall(chat: Chat): Promise<void> {
  const s = chat.s;
  const status = s.verificationId ? await verificationStatus(s.verificationId) : "not_found";
  // The provider's webhook may have landed while this message was on its way.
  if (status === "verified") return phoneConfirmed(chat);
  if (status !== "pending") {
    await chat.say(WA.codeExpired);
    return askMethod(chat);
  }
  const demo = verifyMethods().missed_call === "demo";
  const buttons: [string, Copy][] = [["verify:change", WA.changeMethod]];
  if (demo) buttons.unshift(["verify:simulate", WA.simulateCall]);
  return chat.buttons(WA.waitingForCall, buttons, {
    phone: fmtPhone(s.pendingPhone ?? ""),
    number: missedCallNumber() || "1800-000-0000",
  });
}

async function phoneConfirmed(chat: Chat): Promise<void> {
  const s = chat.s;
  const phone = s.pendingPhone;
  if (!phone) return reprompt(chat);
  s.pendingPhone = undefined;
  s.verificationId = undefined;
  await chat.say(WA.phoneVerified, { phone: fmtPhone(phone) });
  return finishOrder(chat, phone);
}

// ---- Order ---------------------------------------------------------------------

async function finishOrder(chat: Chat, phone: string): Promise<void> {
  const s = chat.s;
  if (!s.kyc?.canOrder || !s.profile) return reprompt(chat);
  const r = await placeOrder({
    lang: s.lang,
    answers: s.answers,
    profile: s.profile,
    items: cartItems(s),
    business: { tradeName: s.kyc.tradeName, legalName: s.kyc.legalName, gstinMasked: s.kyc.gstinMasked },
    contact: { name: s.contactName ?? s.profileName ?? "WhatsApp customer", phone },
    channel: "whatsapp",
  });
  if (!r.ok) {
    await chat.say(WA.orderFailed, { error: r.issues?.map((i) => i.message).join("; ") || r.error });
    return showBundle(chat);
  }

  s.orderIds.push(r.order.id);
  s.step = "done";
  const base = publicBaseUrl();
  const parts = [
    await chat.t(WA.orderPlaced, {
      id: r.order.id,
      total: formatInr(r.order.monthlyTotal),
      days: r.order.expectedActivationDays,
      phone: fmtPhone(phone),
    }),
    base ? await chat.t(WA.trackLink, { link: `${base}/track/${r.order.id}` }) : await chat.t(WA.trackHere),
  ];
  return chat.buttons(parts.join("\n\n"), [["status", WA.status], ["start_over", STRINGS.startOver]]);
}
