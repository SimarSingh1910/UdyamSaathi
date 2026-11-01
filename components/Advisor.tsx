"use client";

import { useEffect, useRef, useState } from "react";
import {
  BUSINESS_TYPES,
  CITY_TIERS,
  DEFAULT_NEEDS,
  segmentFor,
  type AdvisorAnswers,
  type CurrentInternet,
  type Need,
} from "@/lib/advisor";
import {
  INTERNET_LABELS,
  NEED_LABELS,
  SEGMENT_GROUP_LABEL,
  STRINGS,
  cityText,
  typeText,
  type StringKey,
} from "@/lib/i18n";
import type { LangCode } from "@/lib/languages";
import ContactForm from "./ContactForm";
import { useI18n } from "./I18nProvider";
import SpeakButton from "./SpeakButton";
import VoiceButton from "./VoiceButton";

type Question = "businessType" | "city" | "employees" | "sites" | "currentInternet" | "needs" | "hasGstin";
const ORDER: Question[] = ["businessType", "city", "employees", "sites", "currentInternet", "needs", "hasGstin"];

const PROMPT: Record<Question, StringKey> = {
  businessType: "qType",
  city: "qCity",
  employees: "qEmployees",
  sites: "qSites",
  currentInternet: "qInternet",
  needs: "qNeeds",
  hasGstin: "qGst",
};

const EMPLOYEE_CHOICES: [string, number][] = [["1", 1], ["2–4", 3], ["5–9", 7], ["10–24", 15], ["25–49", 35], ["50+", 60]];
const SITE_CHOICES: [string, number][] = [["1", 1], ["2", 2], ["3", 3], ["4–5", 5], ["6–10", 8]];

/**
 * Scripted bot lines keep their key so they re-render in a newly chosen language;
 * the AI's replies are already written in the owner's language.
 */
type Msg = { from: "bot"; key: StringKey } | { from: "bot"; text: string; ai: true } | { from: "me"; text: string };

interface ChatResponse {
  reply: string | null;
  updates: Partial<AdvisorAnswers>;
  next: Question | null;
  handoff: boolean;
  asking: Question | null;
  language: LangCode | null;
  source: "llm" | "rules";
}

interface Props {
  onDone: (answers: AdvisorAnswers) => void;
}

/**
 * Hybrid advisor: the owner can type or speak anything at any point (the AI answers
 * questions and picks up facts), and the buttons for the current question remain as
 * a shortcut. The bundle itself is always built by the rules engine.
 */
export default function Advisor({ onDone }: Props) {
  const { t, tt, lang, setLang } = useI18n();
  const [answers, setAnswers] = useState<Partial<AdvisorAnswers>>({});
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", key: "hello" }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [handoff, setHandoff] = useState<"no" | "form" | "sent">("no");
  const [handoffBusy, setHandoffBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef<Set<Question>>(new Set());
  const parsedNeeds = useRef<Need[]>([]);

  const pending = ORDER.find((q) => answers[q] === undefined);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, pending, handoff]);

  // Ask each question once (unless the AI already asked it in its own words).
  useEffect(() => {
    if (!pending) {
      onDone(answers as AdvisorAnswers);
      return;
    }
    if (pending === "needs" && !asked.current.has("needs")) {
      const seg = segmentFor({ businessType: answers.businessType ?? "", sites: answers.sites ?? 1 });
      setNeeds(parsedNeeds.current.length ? parsedNeeds.current : DEFAULT_NEEDS[seg]);
    }
    if (asked.current.has(pending)) return;
    asked.current.add(pending);
    setMsgs((m) => [...m, { from: "bot", key: PROMPT[pending] }]);
  }, [pending, answers, onDone]);

  function answer<K extends Question>(key: K, value: AdvisorAnswers[K], shown: string) {
    setMsgs((m) => [...m, { from: "me", text: shown }]);
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  /** What the AI sees: scripted lines in English, everything else as said. */
  const history = (list: Msg[]) =>
    list.map((m) =>
      m.from === "me"
        ? { role: "user" as const, content: m.text }
        : { role: "assistant" as const, content: "key" in m ? STRINGS[m.key].en : m.text },
    );

  async function send(raw?: string) {
    const message = (raw ?? text).trim();
    if (!message || busy) return;
    setText("");
    setBusy(true);
    const withMine: Msg[] = [...msgs, { from: "me", text: message }];
    setMsgs(withMine);
    try {
      const res = await fetch("/api/advisor/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ history: history(withMine), answers, lang, pending }),
      });
      if (!res.ok) throw new Error();
      const data: ChatResponse = await res.json();

      // Needs get confirmed on their own screen: mentioned early, they only preselect.
      const { needs: saidNeeds, ...rest } = data.updates ?? {};
      if (saidNeeds?.length) {
        parsedNeeds.current = saidNeeds;
        if (pending === "needs") setNeeds(saidNeeds);
      }
      const update: Partial<AdvisorAnswers> = { ...rest };
      if (pending === "needs" && saidNeeds?.length) update.needs = saidNeeds;

      if (data.language && data.language !== lang) setLang(data.language);
      if (data.reply) {
        setMsgs((m) => [...m, { from: "bot", text: data.reply!, ai: true }]);
        // If the AI already asked for the fact we need next, don't ask it again;
        // otherwise the scripted question (with its buttons) follows.
        if (data.next && data.asking === data.next) asked.current.add(data.next);
        else if (data.next) asked.current.delete(data.next);
      } else if (!Object.keys(update).length) {
        setMsgs((m) => [...m, { from: "bot", key: "notUnderstood" }]);
      }
      if (data.handoff) setHandoff("form");
      setAnswers((a) => ({ ...a, ...update }));
    } catch {
      setMsgs((m) => [...m, { from: "bot", key: "somethingWrong" }]);
    } finally {
      setBusy(false);
    }
  }

  async function requestCall(contact: { name: string; phone: string }) {
    setHandoffBusy(true);
    try {
      const lastAsk = [...msgs].reverse().find((m) => m.from === "me");
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "callback",
          contact,
          business: { businessType: answers.businessType, city: answers.city },
          reasons: [lastAsk && "text" in lastAsk ? `Asked the advisor: "${lastAsk.text}"` : "Asked to talk to a person"],
        }),
      });
      if (res.ok) setHandoff("sent");
    } finally {
      setHandoffBusy(false);
    }
  }

  const chip = (label: string, onClick: () => void, active = false) => (
    <button type="button" key={label} className={`chip${active ? " chip-on" : ""}`} onClick={onClick} disabled={busy}>
      {label}
    </button>
  );

  function shortcuts() {
    switch (pending) {
      case "businessType":
        return (
          <div className="choices">
            {(Object.keys(BUSINESS_TYPES) as (keyof typeof BUSINESS_TYPES)[]).map((seg) => (
              <div key={seg}>
                <p className="group-label">{tt(SEGMENT_GROUP_LABEL[seg])}</p>
                <div className="chips">
                  {BUSINESS_TYPES[seg].map((b) => chip(tt(typeText(b)), () => answer("businessType", b, tt(typeText(b)))))}
                </div>
              </div>
            ))}
          </div>
        );
      case "city":
        return (
          <div className="chips">
            {Object.keys(CITY_TIERS).map((c) => chip(tt(cityText(c)), () => answer("city", c, tt(cityText(c)))))}
            {chip(t("otherCity"), () => answer("city", "Other", t("otherCity")))}
          </div>
        );
      case "employees":
        return <div className="chips">{EMPLOYEE_CHOICES.map(([l, v]) => chip(l, () => answer("employees", v, l)))}</div>;
      case "sites":
        return <div className="chips">{SITE_CHOICES.map(([l, v]) => chip(l, () => answer("sites", v, l)))}</div>;
      case "currentInternet":
        return (
          <div className="chips">
            {(Object.keys(INTERNET_LABELS) as CurrentInternet[]).map((k) =>
              chip(tt(INTERNET_LABELS[k]), () => answer("currentInternet", k, tt(INTERNET_LABELS[k]))),
            )}
          </div>
        );
      case "needs":
        return (
          <div>
            <div className="chips">
              {(Object.keys(NEED_LABELS) as Need[]).map((n) =>
                chip(
                  tt(NEED_LABELS[n]),
                  () => setNeeds((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n])),
                  needs.includes(n),
                ),
              )}
            </div>
            <button
              className="btn"
              disabled={busy}
              onClick={() => answer("needs", needs, needs.map((n) => tt(NEED_LABELS[n])).join(", ") || "—")}
            >
              {t("done")}
            </button>
          </div>
        );
      case "hasGstin":
        return (
          <div className="chips">
            {chip(t("yes"), () => answer("hasGstin", true, t("yes")))}
            {chip(t("no"), () => answer("hasGstin", false, t("no")))}
          </div>
        );
      default:
        return <p className="muted">{t("thinking")}</p>;
    }
  }

  return (
    <section className="chat">
      {msgs.map((m, i) => (
        <div key={i} className={`bubble ${m.from}${"ai" in m ? " ai" : ""}`}>
          {"key" in m ? t(m.key) : m.text}
          {m.from === "bot" && <SpeakButton text={"key" in m ? t(m.key) : m.text} />}
        </div>
      ))}
      {busy && <div className="bubble bot typing">…</div>}

      {handoff === "form" && (
        <ContactForm title={t("helpTitle")} submitLabel={t("requestHelp")} busy={handoffBusy} onSubmit={requestCall} />
      )}
      {handoff === "sent" && <p className="card ok-card small">{t("callbackSent")}</p>}

      <div className="chat-input">
        {pending && shortcuts()}
        {pending && (
          <form
            className="answer-bar"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("chatPlaceholder")}
              disabled={busy}
              aria-label={t("chatPlaceholder")}
            />
            <button className="btn btn-small" disabled={busy || !text.trim()}>
              {t("send")}
            </button>
            <VoiceButton onText={(said) => send(said)} disabled={busy} />
          </form>
        )}
        {pending && handoff === "no" && (
          <button type="button" className="linkbtn small talk-human" onClick={() => setHandoff("form")}>
            {t("talkToPerson")}
          </button>
        )}
      </div>
      <div ref={endRef} />
    </section>
  );
}
