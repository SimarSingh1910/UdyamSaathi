"use client";

import { useEffect, useRef, useState } from "react";
import type { AdvisorAnswers } from "@/lib/advisor";
import { ACTION_LABEL, GUIDE_LABEL_KEYS, type ActionId, type Screen } from "@/lib/app-guide";
import type { BusinessProfile } from "@/lib/eligibility";
import { STRINGS, type StringKey, type Text } from "@/lib/i18n";
import type { QuoteItemInput } from "@/lib/quote";
import ContactForm from "./ContactForm";
import { useI18n } from "./I18nProvider";
import { OPEN_LANGUAGE_EVENT } from "./LanguagePicker";
import SpeakButton from "./SpeakButton";
import VoiceButton from "./VoiceButton";

/**
 * Floating help assistant (bottom right). It knows the app's screens and the owner's
 * own bundle, KYC and order, answers in their language, can read answers aloud, and
 * offers one-tap buttons to go where they need to.
 */

export interface AssistantContext {
  answers?: Partial<AdvisorAnswers> | null;
  profile?: BusinessProfile;
  items?: QuoteItemInput[];
  lines?: { productId: string; quantity: number; on: boolean; core: boolean; why?: string }[];
  skipped?: { name: string; why: string }[];
  kyc?: { checked: boolean; approved: boolean; issues: string[] };
  orderId?: string;
}

interface Props {
  screen: Screen;
  /** Buttons that make sense right now; "open_language" and "talk_to_person" are handled here. */
  actions: ActionId[];
  onAction?: (a: ActionId) => void;
  context: AssistantContext;
  business?: { businessType?: string; city?: string };
}

type Msg = { from: "bot"; text: string | Text; action?: ActionId | null } | { from: "me"; text: string };

const SUGGESTIONS: Record<Screen, StringKey[]> = {
  advisor: ["sugLanguage"],
  recommendation: ["sugWhy", "sugChangeAnswers", "sugLanguage"],
  quote: ["sugRemove", "sugSetup", "sugLanguage"],
  kyc: ["sugDocs", "sugFailed"],
  contact: ["sugNumber"],
  done: ["sugWhen", "sugLanguage"],
  tracker: ["sugWhen", "sugLanguage"],
};

export default function Assistant({ screen, actions, onAction, context, business }: Props) {
  const { lang, t, tt } = useI18n();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState<"no" | "form" | "sent">("no");
  const [handoffBusy, setHandoffBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy, handoff, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const show = (m: string | Text) => (typeof m === "string" ? m : tt(m));

  async function send(said?: string) {
    const msg = (said ?? text).trim();
    if (!msg || busy) return;
    setText("");
    const withMine: Msg[] = [...msgs, { from: "me", text: msg }];
    setMsgs(withMine);
    setBusy(true);
    try {
      const labels = Object.fromEntries(GUIDE_LABEL_KEYS.map((k) => [k, t(k)]));
      const history = withMine.map((m) => ({
        role: m.from === "me" ? "user" : "assistant",
        content: typeof m.text === "string" ? m.text : m.text.en,
      }));
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ history, lang, screen, labels, actions, ...context, answers: context.answers ?? undefined }),
      });
      if (!res.ok) throw new Error();
      const data: { reply: string | Text; action: ActionId | null } = await res.json();
      setMsgs((m) => [...m, { from: "bot", text: data.reply, action: data.action }]);
    } catch {
      setMsgs((m) => [...m, { from: "bot", text: STRINGS.somethingWrong }]);
    } finally {
      setBusy(false);
    }
  }

  function act(a: ActionId) {
    if (a === "talk_to_person") return setHandoff("form");
    if (a === "open_language") return window.dispatchEvent(new Event(OPEN_LANGUAGE_EVENT));
    onAction?.(a);
    setOpen(false);
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
          business: business ?? { businessType: context.answers?.businessType, city: context.answers?.city },
          reasons: [lastAsk ? `Asked the help assistant (${screen} screen): "${lastAsk.text}"` : `Asked for a call from the ${screen} screen`],
        }),
      });
      if (res.ok) setHandoff("sent");
    } finally {
      setHandoffBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="fab" onClick={() => setOpen(true)} aria-label={t("assistantOpen")} title={t("assistantOpen")}>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth="2.6" />
        </svg>
      </button>
    );
  }

  const hello = t("assistantHello");
  const asked = msgs.some((m) => m.from === "me");

  return (
    <div className="assistant" role="dialog" aria-label={t("assistantTitle")}>
      <div className="assistant-head">
        <b>{t("assistantTitle")}</b>
        <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label={t("close")} title={t("close")}>
          ✕
        </button>
      </div>

      <div className="assistant-body chat">
        <div className="bubble bot">
          {hello}
          <SpeakButton text={hello} />
        </div>
        {!asked && (
          <div className="chips">
            {SUGGESTIONS[screen].map((k) => (
              <button key={k} type="button" className="chip" onClick={() => send(t(k))} disabled={busy}>
                {t(k)}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) =>
          m.from === "me" ? (
            <div key={i} className="bubble me">
              {m.text}
            </div>
          ) : (
            <div key={i} className="bubble bot ai">
              {show(m.text)}
              <SpeakButton text={show(m.text)} />
              {m.action && (
                <div>
                  <button type="button" className="btn btn-small bubble-action" onClick={() => act(m.action!)}>
                    {t(ACTION_LABEL[m.action])}
                  </button>
                </div>
              )}
            </div>
          ),
        )}
        {busy && <div className="bubble bot typing">…</div>}
        {handoff === "form" && (
          <ContactForm title={t("helpTitle")} submitLabel={t("requestHelp")} busy={handoffBusy} onSubmit={requestCall} />
        )}
        {handoff === "sent" && <p className="card ok-card small">{t("callbackSent")}</p>}
        <div ref={endRef} />
      </div>

      <form
        className="answer-bar assistant-input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("assistantPlaceholder")}
          aria-label={t("assistantPlaceholder")}
          disabled={busy}
        />
        <button className="btn btn-small" disabled={busy || !text.trim()}>
          {t("send")}
        </button>
        <VoiceButton onText={(said) => send(said)} disabled={busy} />
      </form>
    </div>
  );
}
