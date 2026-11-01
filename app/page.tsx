"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import LanguagePicker from "@/components/LanguagePicker";
import type { StringKey } from "@/lib/i18n";

const STEPS: [StringKey, StringKey][] = [
  ["landing1Title", "landing1Body"],
  ["landing2Title", "landing2Body"],
  ["landing3Title", "landing3Body"],
  ["landing4Title", "landing4Body"],
];

export default function Home() {
  const { t } = useI18n();
  return (
    <main>
      <header className="topbar">
        <span className="badge">Accel Business</span>
        <LanguagePicker />
      </header>
      <h1>{t("heroTitle")}</h1>
      <p className="muted">{t("heroBody")}</p>

      <Link href="/start" className="btn btn-block">
        {t("startNow")}
      </Link>

      {STEPS.map(([title, body], i) => (
        <section className="card step" key={title}>
          <span className="step-num">{i + 1}</span>
          <div>
            <h2>{t(title)}</h2>
            <p className="muted">{t(body)}</p>
          </div>
        </section>
      ))}
      <p className="small muted">🌐 {t("languagesCount")}</p>
    </main>
  );
}
