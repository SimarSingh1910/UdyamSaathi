"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/advisor";
import { formatInr, tr } from "@/lib/i18n";
import { lineStatus, loadOrder, milestones, type Order } from "@/lib/orders";

const DAY_MS = 86_400_000;
const DEMO_DAY_MS = 5_000;

const STATUS_LABEL = {
  pending: { en: "Scheduled", hi: "तय" },
  installing: { en: "Engineer visit today", hi: "आज इंजीनियर आएंगे" },
  active: { en: "Active", hi: "चालू" },
};

export default function Tracker({ id }: { id: string }) {
  const [lang, setLang] = useState<Lang>("en");
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [demo, setDemo] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => setOrder(loadOrder(id)), [id]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (order === undefined) return <main />;
  if (!order) {
    return (
      <main>
        <p className="card">{tr("noOrder", lang)}</p>
        <Link href="/start" className="btn">
          {tr("appName", lang)}
        </Link>
      </main>
    );
  }

  const elapsed = (now - order.createdAt) / (demo ? DEMO_DAY_MS : DAY_MS);
  const ms = milestones(order);
  const current = ms.filter((m) => elapsed >= m.day).length - 1;
  const date = (day: number) =>
    new Date(order.createdAt + day * DAY_MS).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {
      day: "numeric",
      month: "short",
    });

  return (
    <main>
      <header className="topbar">
        <Link href="/" className="brand">
          {tr("appName", lang)}
        </Link>
        <button className="chip" onClick={() => setLang(lang === "en" ? "hi" : "en")}>
          {tr("langToggle", lang)}
        </button>
      </header>

      <h1>{tr("trackerTitle", lang)}</h1>
      <p className="muted">
        {order.businessName && <>{order.businessName} · </>}
        {tr("orderId", lang)} <b>{order.id}</b>
      </p>

      <div className="card">
        <ol className="timeline">
          {ms.map((m, i) => (
            <li key={m.key} className={i < current ? "done" : i === current ? "now" : ""}>
              <span className="dot" />
              <div>
                <b>{m.label[lang]}</b>
                <p className="small muted">
                  {i <= current ? "✓ " : `${tr("expected", lang)} `}
                  {date(m.day)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="card">
        {order.lines.map((l) => {
          const s = lineStatus(l.installDays, elapsed);
          return (
            <div key={l.productId} className="item-head line">
              <span>
                {l.name} {l.quantity > 1 && <span className="muted">× {l.quantity}</span>}
              </span>
              <span className={`pill pill-${s}`}>{STATUS_LABEL[s][lang]}</span>
            </div>
          );
        })}
        <p className="small muted">
          {tr("activatedOn", lang)}: <b>{date(order.expectedActivationDays)}</b> · {formatInr(order.monthlyTotal)}
          {tr("perMonth", lang)}
        </p>
      </div>

      <label className="toggle small">
        <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
        {tr("demoSpeed", lang)}
      </label>
      <p className="small muted">{tr("needHelp", lang)}</p>
    </main>
  );
}
