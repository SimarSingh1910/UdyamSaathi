"use client";

import { useEffect, useRef, useState } from "react";
import {
  BUSINESS_TYPES,
  CITY_TIERS,
  DEFAULT_NEEDS,
  segmentFor,
  type AdvisorAnswers,
  type CurrentInternet,
  type Lang,
  type Need,
} from "@/lib/advisor";
import { INTERNET_LABELS, NEED_LABELS, STRINGS, tr, typeLabel } from "@/lib/i18n";

type Question = "businessType" | "city" | "employees" | "sites" | "currentInternet" | "needs" | "hasGstin";
const ORDER: Question[] = ["businessType", "city", "employees", "sites", "currentInternet", "needs", "hasGstin"];

const PROMPT: Record<Question, keyof typeof STRINGS> = {
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
const SEGMENT_GROUP_LABEL = {
  micro: { en: "Shop or service", hi: "दुकान या सेवा" },
  prof: { en: "Office or clinic", hi: "ऑफ़िस या क्लिनिक" },
  multi: { en: "Chain with many outlets", hi: "कई आउटलेट वाली चेन" },
  mfg: { en: "Factory or workshop", hi: "फ़ैक्ट्री या वर्कशॉप" },
} as const;

interface Msg {
  from: "bot" | "me";
  text: string;
}

interface Props {
  lang: Lang;
  onDone: (answers: AdvisorAnswers) => void;
}

export default function Advisor({ lang, onDone }: Props) {
  const [answers, setAnswers] = useState<Partial<AdvisorAnswers>>({});
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: tr("hello", lang) }]);
  const [mode, setMode] = useState<"intro" | "questions">("intro");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [needs, setNeeds] = useState<Need[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const pending = ORDER.find((q) => answers[q] === undefined);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, pending]);

  // Ask the next question once per question.
  const asked = useRef<Set<Question>>(new Set());
  const parsedNeeds = useRef<Need[]>([]);
  useEffect(() => {
    if (mode !== "questions") return;
    if (!pending) {
      onDone(answers as AdvisorAnswers);
      return;
    }
    if (asked.current.has(pending)) return;
    asked.current.add(pending);
    if (pending === "needs") {
      const seg = segmentFor({ businessType: answers.businessType ?? "", sites: answers.sites ?? 1 });
      const said = parsedNeeds.current;
      setNeeds(said.length ? said : DEFAULT_NEEDS[seg]);
    }
    setMsgs((m) => [...m, { from: "bot", text: tr(PROMPT[pending] as never, lang) }]);
  }, [mode, pending, answers, lang, onDone]);

  function answer<K extends Question>(key: K, value: AdvisorAnswers[K], shown: string) {
    setMsgs((m) => [...m, { from: "me", text: shown }]);
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  async function sendFreeText() {
    const message = text.trim();
    if (!message) return;
    setText("");
    setBusy(true);
    setMsgs((m) => [...m, { from: "me", text: message }]);
    try {
      const res = await fetch("/api/advisor/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      const parsed: Partial<AdvisorAnswers> = data.answers ?? {};
      // Needs are always confirmed explicitly, so keep them as a preselection only.
      const { needs: saidNeeds, ...rest } = parsed;
      if (saidNeeds?.length) parsedNeeds.current = saidNeeds;
      setAnswers((a) => ({ ...a, ...rest }));
      const known = Object.keys(rest).length;
      setMsgs((m) => [...m, { from: "bot", text: known ? tr("understood", lang) : tr("describePrompt", lang) }]);
    } catch {
      /* fall through to step-by-step questions */
    } finally {
      setBusy(false);
      setMode("questions");
    }
  }

  const chip = (label: string, onClick: () => void, active = false) => (
    <button type="button" key={label} className={`chip${active ? " chip-on" : ""}`} onClick={onClick}>
      {label}
    </button>
  );

  function renderInput() {
    if (mode === "intro") {
      return (
        <div className="composer">
          <p className="muted small">{tr("describePrompt", lang)}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={tr("describePlaceholder", lang)}
            rows={3}
            disabled={busy}
          />
          <div className="row">
            <button className="btn" onClick={sendFreeText} disabled={busy || !text.trim()}>
              {busy ? "…" : tr("send", lang)}
            </button>
            <button className="btn btn-ghost" onClick={() => setMode("questions")}>
              {tr("stepByStep", lang)}
            </button>
          </div>
        </div>
      );
    }

    switch (pending) {
      case "businessType":
        return (
          <div className="choices">
            {(Object.keys(BUSINESS_TYPES) as (keyof typeof BUSINESS_TYPES)[]).map((seg) => (
              <div key={seg}>
                <p className="group-label">{SEGMENT_GROUP_LABEL[seg][lang]}</p>
                <div className="chips">
                  {BUSINESS_TYPES[seg].map((t) => chip(typeLabel(t, lang), () => answer("businessType", t, typeLabel(t, lang))))}
                </div>
              </div>
            ))}
          </div>
        );
      case "city":
        return (
          <div className="chips">
            {Object.keys(CITY_TIERS).map((c) => chip(c, () => answer("city", c, c)))}
            {chip(tr("otherCity", lang), () => answer("city", "Other", tr("otherCity", lang)))}
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
              chip(INTERNET_LABELS[k][lang], () => answer("currentInternet", k, INTERNET_LABELS[k][lang])),
            )}
          </div>
        );
      case "needs":
        return (
          <div>
            <div className="chips">
              {(Object.keys(NEED_LABELS) as Need[]).map((n) =>
                chip(
                  NEED_LABELS[n][lang],
                  () => setNeeds((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n])),
                  needs.includes(n),
                ),
              )}
            </div>
            <button
              className="btn"
              onClick={() => answer("needs", needs, needs.map((n) => NEED_LABELS[n][lang]).join(", ") || "—")}
            >
              {tr("done", lang)}
            </button>
          </div>
        );
      case "hasGstin":
        return (
          <div className="chips">
            {chip(tr("yes", lang), () => answer("hasGstin", true, tr("yes", lang)))}
            {chip(tr("no", lang), () => answer("hasGstin", false, tr("no", lang)))}
          </div>
        );
      default:
        return <p className="muted">{tr("thinking", lang)}</p>;
    }
  }

  return (
    <section className="chat">
      {msgs.map((m, i) => (
        <div key={i} className={`bubble ${m.from}`}>
          {m.text}
        </div>
      ))}
      <div className="chat-input">{renderInput()}</div>
      <div ref={endRef} />
    </section>
  );
}
