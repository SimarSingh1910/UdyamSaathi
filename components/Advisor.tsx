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
import { INTERNET_LABELS, NEED_LABELS, SEGMENT_GROUP_LABEL, cityText, typeText, type StringKey } from "@/lib/i18n";
import { useI18n } from "./I18nProvider";

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

/** Bot messages keep their key so they re-render in a newly chosen language. */
type Msg = { from: "bot"; key: StringKey } | { from: "me"; text: string };

interface Props {
  onDone: (answers: AdvisorAnswers) => void;
}

export default function Advisor({ onDone }: Props) {
  const { t, tt } = useI18n();
  const [answers, setAnswers] = useState<Partial<AdvisorAnswers>>({});
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", key: "hello" }]);
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
    setMsgs((m) => [...m, { from: "bot", key: PROMPT[pending] }]);
  }, [mode, pending, answers, onDone]);

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
      setMsgs((m) => [...m, { from: "bot", key: known ? "understood" : "describePrompt" }]);
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
          <p className="muted small">{t("describePrompt")}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("describePlaceholder")}
            rows={3}
            disabled={busy}
          />
          <div className="row">
            <button className="btn" onClick={sendFreeText} disabled={busy || !text.trim()}>
              {busy ? "…" : t("send")}
            </button>
            <button className="btn btn-ghost" onClick={() => setMode("questions")}>
              {t("stepByStep")}
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
        <div key={i} className={`bubble ${m.from}`}>
          {m.from === "bot" ? t(m.key) : m.text}
        </div>
      ))}
      <div className="chat-input">{renderInput()}</div>
      <div ref={endRef} />
    </section>
  );
}
