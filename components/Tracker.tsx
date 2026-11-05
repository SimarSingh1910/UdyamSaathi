"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatInr } from "@/lib/i18n";
import { dateLocale } from "@/lib/languages";
import { LINE_LABEL, STATUS_FLOW, STATUS_LABEL, expectedDays } from "@/lib/order-flow";
import type { Order } from "@/lib/store";
import Assistant from "./Assistant";
import { useI18n } from "./I18nProvider";
import LanguagePicker from "./LanguagePicker";

const POLL_MS = 5000;
const DAY_MS = 86_400_000;

export default function Tracker({ id }: { id: string }) {
  const { lang, t, tt, chosen, setLang } = useI18n();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);

  // Default to the language the owner ordered in, unless they picked one on this device.
  useEffect(() => {
    if (order && !chosen && order.lang !== lang) setLang(order.lang);
  }, [order, chosen, lang, setLang]);

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
        {t("appName")}
      </Link>
      <Link href="/" className="home-link">
        {t("demoHome")}
      </Link>
      <LanguagePicker />
    </header>
  );

  if (order === undefined) return <main>{header}</main>;
  if (!order) {
    return (
      <main>
        {header}
        <p className="card">{t("noOrder")}</p>
        <Link href="/start" className="btn">
          {t("appName")}
        </Link>
      </main>
    );
  }

  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short" });
  const fmtTime = (ms: number) =>
    new Date(ms).toLocaleString(dateLocale(lang), {
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
      <h1>{t("trackerTitle")}</h1>
      <p className="muted">
        {order.business.tradeName} · {t("orderId")} <b>{order.id}</b>
      </p>

      {cancelled ? (
        <div className="card warn-card">
          <b>{tt(STATUS_LABEL.cancelled)}</b>
          <p className="small">{order.events.at(-1) ? tt(order.events.at(-1)!.note) : ""}</p>
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
                    <b>{tt(STATUS_LABEL[s])}</b>
                    <p className="small muted">
                      {at ? `✓ ${fmtTime(at)}` : `${t("expected")} ${fmt(expected)}`}
                    </p>
                    {s === "scheduled" && order.installSlot && (
                      <p className="small">
                        📅 {fmt(new Date(`${order.installSlot}T00:00:00+05:30`).getTime())}
                        {order.engineer && ` · ${t("engineer")}: ${order.engineer}`}
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
            <span className={`pill pill-${l.status}`}>{tt(LINE_LABEL[l.status])}</span>
          </div>
        ))}
        <p className="small muted">
          {formatInr(order.monthlyTotal)}
          {t("perMonth")} · {t("contract")} {order.contractMonths} {t("months")}
        </p>
      </div>

      <h3>{t("updates")}</h3>
      <div className="card">
        {[...order.events].reverse().map((e, i) => (
          <p key={i} className="small">
            <span className="muted">{fmtTime(e.at)}</span> · {tt(e.note)}
          </p>
        ))}
      </div>

      <p className="small muted">{t("liveNote")}</p>
      <p className="small muted">{t("needHelp")}</p>

      <Assistant
        screen="tracker"
        actions={["open_language", "talk_to_person"]}
        context={{ orderId: order.id }}
        business={{ businessType: order.business.businessType, city: order.business.city }}
      />
    </main>
  );
}
