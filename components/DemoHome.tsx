"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import LanguagePicker from "@/components/LanguagePicker";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}

/**
 * The demo's front door: one card for business owners, one for Accel staff.
 * With a passcode (demo sites only), the staff card shows it masked and its
 * button signs straight in; otherwise the button opens the normal sign-in.
 */
export default function DemoHome({ passcode }: { passcode: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function openBackOffice() {
    if (!passcode) return router.push("/admin");
    setBusy(true);
    setFailed(false);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passcode }),
    }).catch(() => null);
    if (res?.ok) router.push("/admin");
    else {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <main>
      <header className="topbar">
        <span className="brand">{t("appName")}</span>
        <LanguagePicker />
      </header>
      <span className="badge">{t("demoLabel")}</span>
      <p className="muted">{t("homeTagline")}</p>

      <section className="card home-card">
        <span className="home-icon" aria-hidden="true">🏪</span>
        <h2>{t("ownerCardTitle")}</h2>
        <p className="muted">{t("ownerCardBody")}</p>
        <Link href="/start" className="btn btn-block">
          {t("ownerCardCta")}
        </Link>
      </section>

      <section className="card home-card">
        <span className="home-icon" aria-hidden="true">🧑‍💼</span>
        <h2>{t("staffCardTitle")}</h2>
        <p className="muted">{t("staffCardBody")}</p>
        {passcode && (
          <div className="passcode">
            <span className="small muted">{t("passcodeLabel")}</span>
            <div className="row">
              <code className="grow">{shown ? passcode : "*".repeat(passcode.length)}</code>
              <button
                type="button"
                className="eye"
                onClick={() => setShown((s) => !s)}
                aria-label={t(shown ? "hidePasscode" : "showPasscode")}
                title={t(shown ? "hidePasscode" : "showPasscode")}
              >
                <EyeIcon open={!shown} />
              </button>
            </div>
            <span className="small muted">{t("passcodeNote")}</span>
          </div>
        )}
        <button type="button" className="btn btn-block" disabled={busy} onClick={openBackOffice}>
          {t("staffCardCta")}
        </button>
        {failed && <p className="small fail">{t("signInFailed")}</p>}
      </section>

      <p className="small muted">🌐 {t("languagesCount")}</p>
    </main>
  );
}
