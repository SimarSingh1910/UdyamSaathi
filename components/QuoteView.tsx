"use client";

import { useEffect, useMemo, useState } from "react";
import type { Recommendation } from "@/lib/advisor";
import type { Product } from "@/lib/catalogue";
import { formatInr, type StringKey, type Text } from "@/lib/i18n";
import type { Quote } from "@/lib/quote";
import { useI18n } from "./I18nProvider";

const PRICING_LABEL: Record<Quote["pricingTier"], StringKey> = {
  single: "priceSingle",
  bundle: "priceBundle",
  full_bundle: "priceFullBundle",
};

export interface CartLine {
  productId: string;
  quantity: number;
  on: boolean;
  core: boolean;
  why?: Text;
}

interface Props {
  rec: Recommendation;
  cart: CartLine[];
  setCart: (c: CartLine[]) => void;
  onBack: () => void;
  onContinue: (quote: Quote) => void;
}

export default function QuoteView({ rec, cart, setCart, onBack, onContinue }: Props) {
  const { t, tt } = useI18n();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [catalogue, setCatalogue] = useState<(Product & { eligibility?: { eligible: boolean } })[]>([]);
  const [showMore, setShowMore] = useState(false);
  const { profile } = rec;

  useEffect(() => {
    const q = new URLSearchParams({
      tier: String(profile.cityTier),
      employees: String(profile.employees),
      sites: String(profile.sites),
      gstin: profile.hasActiveGstin ? "active" : "none",
    });
    fetch(`/api/catalogue?${q}`)
      .then((r) => r.json())
      .then((d) => setCatalogue(d.products ?? []))
      .catch(() => setCatalogue([]));
  }, [profile]);

  const byId = useMemo(() => new Map(catalogue.map((p) => [p.id, p])), [catalogue]);
  const active = cart.filter((l) => l.on && l.quantity > 0);
  const cartKey = JSON.stringify(active.map((l) => [l.productId, l.quantity]));

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      if (!active.length) {
        setQuote(null);
        return;
      }
      fetch("/api/quote", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile, items: active.map(({ productId, quantity }) => ({ productId, quantity })) }),
      })
        .then((r) => r.json())
        .then(setQuote)
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, profile]);

  const update = (id: string, patch: Partial<CartLine>) =>
    setCart(cart.map((l) => (l.productId === id ? { ...l, ...patch } : l)));

  const addExtra = (p: Product) => {
    const qty = p.unit === "per site" ? profile.sites : 1;
    setCart([...cart, { productId: p.id, quantity: qty, on: true, core: false }]);
  };

  const lineFor = (id: string) => quote?.lines.find((l) => l.productId === id);
  const extras = catalogue.filter((p) => p.eligibility?.eligible && !cart.some((c) => c.productId === p.id));

  const row = (l: CartLine) => {
    const p = byId.get(l.productId);
    const ql = lineFor(l.productId);
    return (
      <div key={l.productId} className={`item${l.on ? "" : " item-off"}`}>
        <div className="item-head">
          <label className="toggle">
            <input type="checkbox" checked={l.on} onChange={(e) => update(l.productId, { on: e.target.checked })} />
            <span className="item-name">{p?.name ?? l.productId}</span>
          </label>
          <span className="item-price">{ql ? `${formatInr(ql.monthly)}${t("perMonth")}` : "—"}</span>
        </div>
        {l.why && <p className="muted small">{tt(l.why)}</p>}
        {l.on && (
          <div className="stepper">
            <button aria-label="less" onClick={() => update(l.productId, { quantity: Math.max(1, l.quantity - 1) })}>
              −
            </button>
            <span>
              {l.quantity} × {p?.unit.replace("per ", "") ?? ""}
            </span>
            <button aria-label="more" onClick={() => update(l.productId, { quantity: Math.min(100, l.quantity + 1) })}>
              +
            </button>
            {ql && ql.unitPrice < ql.listPrice && (
              <span className="small strike">{formatInr(ql.listPrice)}</span>
            )}
            {ql && <span className="small">{formatInr(ql.unitPrice)} {t("each")}</span>}
          </div>
        )}
      </div>
    );
  };

  const issues = quote?.issues ?? [];

  return (
    <section>
      <div className="total card sticky">
        <div className="total-main">
          <span className="muted small">{t("monthlyTotal")}</span>
          <strong>{quote ? formatInr(quote.monthlyTotal) : "—"}</strong>
          <span className="muted small">
            {t("perMonth")} · {t("inclGst")}
          </span>
        </div>
        {quote && (
          <div className="total-meta small">
            <span>
              {t("oneTime")}: <b>{formatInr(quote.setupTotal)}</b>
            </span>
            <span>
              {t("contract")}: <b>{quote.contractMonths} {t("months")}</b>
            </span>
            <span>
              {t("readyIn")} <b>{quote.expectedActivationDays} {t("days")}</b>
            </span>
            {quote.monthlySavings > 0 && (
              <span className="ok">
                {t("savings")}: <b>{formatInr(quote.monthlySavings)}{t("perMonth")}</b>
              </span>
            )}
            <span className="badge">{t(PRICING_LABEL[quote.pricingTier])}</span>
          </div>
        )}
      </div>

      {issues.length > 0 && (
        <div className="card warn-card">
          {issues.map((i, n) => (
            <p key={n} className="small">
              ⚠️ {tt(i.message)}
            </p>
          ))}
        </div>
      )}

      <h3>{t("essentials")}</h3>
      {cart.filter((l) => l.core).map(row)}

      <h3>{t("addOns")}</h3>
      {cart.filter((l) => !l.core).map(row)}

      {rec.skipped.length > 0 && (
        <details className="card">
          <summary className="small">{t("notIncluded")}</summary>
          {rec.skipped.map((s) => (
            <p key={s.productId} className="small muted">
              <b>{s.name}</b>: {tt(s.why)}
            </p>
          ))}
        </details>
      )}

      <button className="btn btn-ghost" onClick={() => setShowMore((v) => !v)}>
        {t("moreOptions")} ({extras.length})
      </button>
      {showMore && (
        <div>
          {extras.map((p) => (
            <div key={p.id} className="item item-off">
              <div className="item-head">
                <span className="item-name">{p.name}</span>
                <button className="chip" onClick={() => addExtra(p)}>
                  + {formatInr(p.priceMin)}–{formatInr(p.priceMax)}
                </button>
              </div>
              <p className="muted small">{tt(p.description)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="row actions">
        <button className="btn btn-ghost" onClick={onBack}>
          {t("back")}
        </button>
        <button className="btn" disabled={!quote?.ready} onClick={() => quote && onContinue(quote)}>
          {t("continueKyc")}
        </button>
      </div>
    </section>
  );
}
