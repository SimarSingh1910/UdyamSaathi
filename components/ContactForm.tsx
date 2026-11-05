"use client";

import { useEffect, useState } from "react";
import type { StringKey } from "@/lib/i18n";
import { useI18n } from "./I18nProvider";

const normalize = (phone: string) => phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
const valid = (phone: string) => /^[6-9]\d{9}$/.test(normalize(phone));

type Method = "sms" | "voice" | "whatsapp" | "missed_call";
const METHODS: Method[] = ["sms", "voice", "whatsapp", "missed_call"];
type Mode = "live" | "demo" | "off";

interface Check {
  id: string;
  method: Method;
  callNumber?: string;
  demoCode?: string;
  fixedCode?: string;
  demo: boolean;
}

const METHOD_LABEL: Record<Method, StringKey> = {
  sms: "verifySms",
  voice: "verifyVoice",
  whatsapp: "verifyWhatsapp",
  missed_call: "verifyMissedCall",
};
const METHOD_ICON: Record<Method, string> = { sms: "✉️", voice: "📞", whatsapp: "💬", missed_call: "📲" };
const SENT_TO: Record<Exclude<Method, "missed_call">, StringKey> = {
  sms: "codeSentSms",
  voice: "codeSentVoice",
  whatsapp: "codeSentTo",
};

const ERRORS: Record<string, StringKey> = {
  wrong_code: "wrongCode",
  expired: "checkExpired",
  not_found: "checkExpired",
  too_many: "tooManyTries",
  rate_limited: "tooManyChecks",
  send_failed: "codeSendFailed",
  unavailable: "verifyOff",
  invalid_phone: "invalidMobile",
};

interface Props {
  title: string;
  submitLabel: string;
  defaultName?: string;
  busy?: boolean;
  /** phoneToken proves the number was verified; the server checks it. */
  onSubmit: (contact: { name: string; phone: string; phoneToken: string }) => void;
}

/**
 * Name + mobile, the only personal details the order itself needs. Before we use
 * the number, the owner confirms it is theirs: a code on WhatsApp or a missed call,
 * whichever they prefer.
 */
export default function ContactForm({ title, submitLabel, defaultName = "", busy, onSubmit }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [stage, setStage] = useState<"details" | "method" | "verify">("details");
  const [methods, setMethods] = useState<Record<Method, Mode> | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<StringKey | null>(null);
  const [working, setWorking] = useState(false);
  /** Verified number and its token, so a retry after a failed order doesn't verify again. */
  const [verified, setVerified] = useState<{ phone: string; token: string } | null>(null);
  const phoneOk = valid(phone);
  const shown = normalize(phone).replace(/^(\d{5})(\d{5})$/, "$1 $2");

  useEffect(() => {
    fetch("/api/verify")
      .then((r) => r.json())
      .then((d) => setMethods(d.methods))
      .catch(() => setMethods({ sms: "off", voice: "off", whatsapp: "off", missed_call: "off" }));
  }, []);

  function done(token: string) {
    const p = normalize(phone);
    setVerified({ phone: p, token });
    // Back to the details: if the order fails, submitting again reuses the token.
    setStage("details");
    onSubmit({ name: name.trim(), phone: p, phoneToken: token });
  }

  // While waiting for a missed call, ask the server every few seconds whether it came in.
  useEffect(() => {
    if (stage !== "verify" || check?.method !== "missed_call") return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/verify/status?id=${encodeURIComponent(check.id)}&phone=${normalize(phone)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (data.status === "verified" && data.token) {
        clearInterval(timer);
        done(data.token);
      } else if (data.status === "expired" || data.status === "not_found") {
        clearInterval(timer);
        setError("checkExpired");
        setStage("method");
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [stage, check]);

  async function start(method: Method) {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/verify/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: normalize(phone), method }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(ERRORS[data.error] ?? "somethingWrong");
        return;
      }
      setCheck(data);
      setCode("");
      setStage("verify");
    } catch {
      setError("somethingWrong");
    } finally {
      setWorking(false);
    }
  }

  async function submitCode() {
    if (!check) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/verify/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: check.id, phone: normalize(phone), code }),
      });
      const data = await res.json();
      if (res.ok && data.token) return done(data.token);
      setError(ERRORS[data.error] ?? "somethingWrong");
      if (data.error !== "wrong_code") setStage("method");
    } catch {
      setError("somethingWrong");
    } finally {
      setWorking(false);
    }
  }

  async function simulateCall() {
    if (!check) return;
    await fetch("/api/verify/missed-call", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ simulate: check.id }),
    });
  }

  const back = (to: "details" | "method") => (
    <button type="button" className="btn btn-ghost" onClick={() => (setError(null), setStage(to))}>
      {t(to === "details" ? "changeNumber" : "otherMethod")}
    </button>
  );

  if (stage === "method") {
    const offered = METHODS.filter((m) => methods?.[m] !== "off");
    return (
      <div className="card form">
        <b>{title}</b>
        <p>
          {t("verifyHow")} <b>{shown}</b>
        </p>
        {offered.length === 0 && <p className="small fail">{t("verifyOff")}</p>}
        <div className="row actions">
          {offered.map((m) => (
            <button key={m} type="button" className="btn" disabled={working} onClick={() => start(m)}>
              {`${METHOD_ICON[m]} ${t(METHOD_LABEL[m])}`}
            </button>
          ))}
          {/* SMS waits on DLT registration; show it so owners know it's on the way. */}
          {methods && methods.sms === "off" && (
            <button type="button" className="btn" disabled title={t("comingSoon")}>
              {`${METHOD_ICON.sms} ${t("verifySms")} (${t("comingSoon")})`}
            </button>
          )}
        </div>
        {error && <p className="small fail">{t(error)}</p>}
        {back("details")}
      </div>
    );
  }

  if (stage === "verify" && check && check.method !== "missed_call") {
    return (
      <form
        className="card form"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.replace(/\D/g, "").length === 6) submitCode();
        }}
      >
        <b>{title}</b>
        <p>
          {t(SENT_TO[check.method])} <b>{shown}</b>
        </p>
        {check.demoCode && (
          <p className="small muted">
            {t("demoCode")} <b>{check.demoCode}</b>
          </p>
        )}
        {check.fixedCode && (
          <p className="small muted">
            {t("demoFixedCode")} <b>{check.fixedCode}</b>
          </p>
        )}
        <label>
          {t("enterCode")}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="123456"
            autoFocus
            required
          />
        </label>
        {error && <p className="small fail">{t(error)}</p>}
        <button className="btn" disabled={working || busy}>
          {working || busy ? "…" : t("verifyButton")}
        </button>
        {back("method")}
      </form>
    );
  }

  if (stage === "verify" && check?.method === "missed_call") {
    return (
      <div className="card form">
        <b>{title}</b>
        <p>
          {t("giveMissedCall")}{" "}
          <a href={`tel:${check.callNumber?.replace(/[^\d+]/g, "")}`}>
            <b>{check.callNumber}</b>
          </a>
        </p>
        <p className="small muted">{t("missedCallFree")}</p>
        <p className="small">{busy ? "…" : t("waitingForCall")}</p>
        {check.demo && (
          <button type="button" className="btn btn-ghost" onClick={simulateCall}>
            {t("simulateCall")}
          </button>
        )}
        {error && <p className="small fail">{t(error)}</p>}
        {back("method")}
      </div>
    );
  }

  return (
    <form
      className="card form"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!name.trim() || !phoneOk) return;
        if (verified?.phone === normalize(phone)) return onSubmit({ name: name.trim(), phone: verified.phone, phoneToken: verified.token });
        setError(null);
        setStage("method");
      }}
    >
      <b>{title}</b>
      <label>
        {t("contactName")}
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      </label>
      <label>
        {t("mobile")}
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="numeric"
          autoComplete="tel"
          placeholder="98765 43210"
          required
        />
      </label>
      {touched && !phoneOk && <p className="small fail">{t("invalidMobile")}</p>}
      <p className="small muted">{t("contactUse")}</p>
      <button className="btn" disabled={busy}>
        {busy ? "…" : submitLabel}
      </button>
    </form>
  );
}
