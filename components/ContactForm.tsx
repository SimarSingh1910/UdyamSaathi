"use client";

import { useState } from "react";
import type { Lang } from "@/lib/advisor";
import { tr } from "@/lib/i18n";

const valid = (phone: string) => /^[6-9]\d{9}$/.test(phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""));

interface Props {
  lang: Lang;
  title: string;
  submitLabel: string;
  defaultName?: string;
  busy?: boolean;
  onSubmit: (contact: { name: string; phone: string }) => void;
}

/** Name + mobile, the only personal details the order itself needs. */
export default function ContactForm({ lang, title, submitLabel, defaultName = "", busy, onSubmit }: Props) {
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const phoneOk = valid(phone);

  return (
    <form
      className="card form"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (name.trim() && phoneOk) onSubmit({ name: name.trim(), phone });
      }}
    >
      <b>{title}</b>
      <label>
        {tr("contactName", lang)}
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      </label>
      <label>
        {tr("mobile", lang)}
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="numeric"
          autoComplete="tel"
          placeholder="98765 43210"
          required
        />
      </label>
      {touched && !phoneOk && <p className="small fail">{tr("invalidMobile", lang)}</p>}
      <p className="small muted">{tr("contactUse", lang)}</p>
      <button className="btn" disabled={busy}>
        {busy ? "…" : submitLabel}
      </button>
    </form>
  );
}
