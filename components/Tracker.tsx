"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/advisor";
import { formatInr, tr } from "@/lib/i18n";
import { LINE_LABEL, STATUS_FLOW, STATUS_LABEL, expectedDays } from "@/lib/order-flow";
import type { Order } from "@/lib/store";

const POLL_MS = 5000;
const DAY_MS = 86_400_000;

export default function Tracker({ id }: { id: string }) {
  const [chosenLang, setLang] = useState<Lang | null>(null);
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  // Default to the language the owner ordered in, until they switch.
  const lang: Lang = chosenLang ?? order?.lang ?? "en";

  // Poll so status changes made by Accel's team show up without a refresh.
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/orders/${encodeURIComponent(id)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((o: Order | null) => {
          if (!alive) return;
          setOrder(o);
        })
        .catch(() => alive && setOrder((cur) => cur ?? null));
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);

  const header = (
    <header className="topbar">
      <Link href="/" className="brand">
        {tr("appName", lang)}
      </Link>
      <button className="chip" onClick={() => setLang(lang === "en" ? "hi" : "en")}>
        {tr("langToggle", lang)}
      </button>
    </header>
  );

  if (order === undefined) return <main>{header}</main>;
  if (!order) {
    return (
      <main>
        {header}
        <p className="card">{tr("noOrder", lang)}</p>
        <Link href="/start" className="btn">
          {tr("appName", lang)}
        </Link>
      </main>
    );
  }

  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" });
  const fmtTime = (ms: number) =>
    new Date(ms).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });

  const cancelled = order.status === "cancelled";
  const reachedAt = (s: string) => order.events.find((e) => e.status === s)?.at;
  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const plan = expectedDays(order);

  return (
    <main>
      {header}
      <h1>{tr("trackerTitle", lang)}</h1>
      <p className="muted">
        {order.business.tradeName} · {tr("orderId", lang)} <b>{order.id}</b>
      </p>

      {cancelled ? (
        <div className="card warn-card">
          <b>{STATUS_LABEL.cancelled[lang]}</b>
          <p className="small">{order.events.at(-1)?.note[lang]}</p>
        </div>
      ) : (
        <div className="card">
          <ol className="timeline">
            {STATUS_FLOW.map((s, i) => {
              const at = reachedAt(s);
              const expected = order.createdAt + plan[s] * DAY_MS;
              return (
                <li key={s} className={i < currentIdx ? "done" : i === currentIdx ? "now" : ""}>
                  <span className="dot" />
                  <div>
                    <b>{STATUS_LABEL[s][lang]}</b>
                    <p className="small muted">
                      {at ? `✓ ${fmtTime(at)}` : `${tr("expected", lang)} ${fmt(expected)}`}
                    </p>
                    {s === "scheduled" && order.installSlot && (
                      <p className="small">
                        📅 {fmt(new Date(`${order.installSlot}T00:00:00+05:30`).getTime())}
                        {order.engineer && ` · ${tr("engineer", lang)}: ${order.engineer}`}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="card">
        {order.lines.map((l) => (
          <div key={l.productId} className="item-head line">
            <span>
              {l.name} {l.quantity > 1 && <span className="muted">× {l.quantity}</span>}
            </span>
            <span className={`pill pill-${l.status}`}>{LINE_LABEL[l.status][lang]}</span>
          </div>
        ))}
        <p className="small muted">
          {formatInr(order.monthlyTotal)}
          {tr("perMonth", lang)} · {tr("contract", lang)} {order.contractMonths} {tr("months", lang)}
        </p>
      </div>

      <h3>{tr("updates", lang)}</h3>
      <div className="card">
        {[...order.events].reverse().map((e, i) => (
          <p key={i} className="small">
            <span className="muted">{fmtTime(e.at)}</span> · {e.note[lang]}
          </p>
        ))}
      </div>

      <p className="small muted">{tr("liveNote", lang)}</p>
      <p className="small muted">{tr("needHelp", lang)}</p>
    </main>
  );
}
