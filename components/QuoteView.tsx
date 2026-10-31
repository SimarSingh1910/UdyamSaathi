"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lang, Recommendation } from "@/lib/advisor";
import type { Product } from "@/lib/catalogue";
import { STRINGS, formatInr, tr } from "@/lib/i18n";
import type { Quote } from "@/lib/quote";

export interface CartLine {
  productId: string;
  quantity: number;
  on: boolean;
  core: boolean;
  why?: { en: string; hi: string };
}

interface Props {
  lang: Lang;
  rec: Recommendation;
  cart: CartLine[];
  setCart: (c: CartLine[]) => void;
  onBack: () => void;
  onContinue: (quote: Quote) => void;
}

export default function QuoteView({ lang, rec, cart, setCart, onBack, onContinue }: Props) {
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
          <span className="item-price">{ql ? `${formatInr(ql.monthly)}${tr("perMonth", lang)}` : "—"}</span>
        </div>
        {l.why && <p className="muted small">{l.why[lang]}</p>}
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
            {ql && <span className="small">{formatInr(ql.unitPrice)} each</span>}
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
          <span className="muted small">{tr("monthlyTotal", lang)}</span>
          <strong>{quote ? formatInr(quote.monthlyTotal) : "—"}</strong>
          <span className="muted small">
            {tr("perMonth", lang)} · {tr("inclGst", lang)}
          </span>
        </div>
        {quote && (
          <div className="total-meta small">
            <span>
              {tr("oneTime", lang)}: <b>{formatInr(quote.setupTotal)}</b>
            </span>
            <span>
              {tr("contract", lang)}: <b>{quote.contractMonths} {tr("months", lang)}</b>
            </span>
            <span>
              {tr("readyIn", lang)} <b>{quote.expectedActivationDays} {tr("days", lang)}</b>
            </span>
            {quote.monthlySavings > 0 && (
              <span className="ok">
                {tr("savings", lang)}: <b>{formatInr(quote.monthlySavings)}{tr("perMonth", lang)}</b>
              </span>
            )}
            <span className="badge">{STRINGS.bundlePricing[lang][quote.pricingTier]}</span>
          </div>
        )}
      </div>

      {issues.length > 0 && (
        <div className="card warn-card">
          {issues.map((i, n) => (
            <p key={n} className="small">
              ⚠️ {i.message}
            </p>
          ))}
        </div>
      )}

      <h3>{tr("essentials", lang)}</h3>
      {cart.filter((l) => l.core).map(row)}

      <h3>{tr("addOns", lang)}</h3>
      {cart.filter((l) => !l.core).map(row)}

      {rec.skipped.length > 0 && (
        <details className="card">
          <summary className="small">{tr("notIncluded", lang)}</summary>
          {rec.skipped.map((s) => (
            <p key={s.productId} className="small muted">
              <b>{s.name}</b>: {s.why[lang]}
            </p>
          ))}
        </details>
      )}

      <button className="btn btn-ghost" onClick={() => setShowMore((v) => !v)}>
        {tr("moreOptions", lang)} ({extras.length})
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
              <p className="muted small">{p.description}</p>
            </div>
          ))}
        </div>
      )}

      <div className="row actions">
        <button className="btn btn-ghost" onClick={onBack}>
          {tr("back", lang)}
        </button>
        <button className="btn" disabled={!quote?.ready} onClick={() => quote && onContinue(quote)}>
          {tr("continueKyc", lang)}
        </button>
      </div>
    </section>
  );
}
