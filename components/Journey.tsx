"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { AdvisorAnswers, Lang, Recommendation } from "@/lib/advisor";
import type { Product } from "@/lib/catalogue";
import { STRINGS, formatInr, tr } from "@/lib/i18n";
import { newOrderId, saveOrder, type Order } from "@/lib/orders";
import type { Quote } from "@/lib/quote";
import Advisor from "./Advisor";
import Kyc, { type KycOutcome } from "./Kyc";
import QuoteView, { type CartLine } from "./QuoteView";

type Step = "advisor" | "recommendation" | "quote" | "kyc" | "done";

interface RecResponse {
  recommendation: Recommendation;
  quote: Quote;
  pitch: string;
  pitchSource: "llm" | "rules";
}

export default function Journey() {
  const [lang, setLang] = useState<Lang>("en");
  const [step, setStep] = useState<Step>("advisor");
  const [advisorKey, setAdvisorKey] = useState(0);
  const [rec, setRec] = useState<RecResponse | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [kyc, setKyc] = useState<KycOutcome | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onAdvisorDone = useCallback(
    async (answers: AdvisorAnswers) => {
      setError(null);
      try {
        const res = await fetch("/api/advisor/recommend", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers, lang }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data: RecResponse = await res.json();
        setRec(data);
        setCart(
          data.recommendation.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            on: true,
            core: i.core,
            why: i.why,
          })),
        );
        setStep("recommendation");
      } catch {
        setError("Something went wrong. Please try again.");
      }
    },
    [lang],
  );

  async function onKycResult(outcome: KycOutcome) {
    setKyc(outcome);
    if (!rec || outcome.result.gstinUsable) return;
    // GSTIN can't be used: drop products that need one and price the rest without it.
    const catalogue: Product[] = (await (await fetch("/api/catalogue")).json()).products;
    const needsGst = new Set(catalogue.filter((p) => p.requiresGstin).map((p) => p.id));
    setCart((c) => c.filter((l) => !needsGst.has(l.productId)));
    setRec({ ...rec, recommendation: { ...rec.recommendation, profile: { ...rec.recommendation.profile, hasActiveGstin: false } } });
  }

  async function placeOrder() {
    if (!rec) return;
    const items = cart.filter((l) => l.on && l.quantity > 0).map(({ productId, quantity }) => ({ productId, quantity }));
    const quote: Quote = await (
      await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: rec.recommendation.profile, items }),
      })
    ).json();
    const o: Order = {
      id: newOrderId(),
      createdAt: Date.now(),
      businessName: kyc?.result.business?.tradeName ?? "",
      lines: quote.lines.map(({ productId, name, quantity, installDays }) => ({ productId, name, quantity, installDays })),
      monthlyTotal: quote.monthlyTotal,
      setupTotal: quote.setupTotal,
      contractMonths: quote.contractMonths,
      expectedActivationDays: quote.expectedActivationDays,
    };
    saveOrder(o);
    setOrder(o);
    setStep("done");
  }

  function restart() {
    setRec(null);
    setCart([]);
    setKyc(null);
    setOrder(null);
    setAdvisorKey((k) => k + 1);
    setStep("advisor");
  }

  const stepIndex = { advisor: 0, recommendation: 0, quote: 1, kyc: 2, done: 3 }[step];

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

      <ol className="progress">
        {STRINGS.steps[lang].map((s, i) => (
          <li key={s} className={i <= stepIndex ? "on" : ""}>
            {s}
          </li>
        ))}
      </ol>

      {error && <p className="card warn-card small">{error}</p>}

      {step === "advisor" && <Advisor key={advisorKey} lang={lang} onDone={onAdvisorDone} />}

      {step === "recommendation" && rec && (
        <section>
          <div className="card pitch">
            <span className="badge">{rec.pitchSource === "llm" ? "AI" : "Advisor"}</span>
            <p>{rec.pitch}</p>
          </div>
          <h3>{tr("yourBundle", lang)}</h3>
          {rec.recommendation.items.map((i) => {
            const line = rec.quote.lines.find((l) => l.productId === i.productId);
            return (
              <div className="item" key={i.productId}>
                <div className="item-head">
                  <span className="item-name">
                    {line?.name} {i.quantity > 1 && <span className="muted">× {i.quantity}</span>}
                  </span>
                  <span className="item-price">
                    {line ? `${formatInr(line.monthly)}${tr("perMonth", lang)}` : ""}
                  </span>
                </div>
                <p className="muted small">{i.why[lang]}</p>
              </div>
            );
          })}
          <div className="card total-inline">
            <span>{tr("monthlyTotal", lang)}</span>
            <strong>{formatInr(rec.quote.monthlyTotal)}</strong>
            <span className="muted small">{tr("inclGst", lang)}</span>
          </div>
          <div className="row actions">
            <button className="btn btn-ghost" onClick={restart}>
              {tr("startOver", lang)}
            </button>
            <button className="btn" onClick={() => setStep("quote")}>
              {tr("seePrice", lang)}
            </button>
          </div>
        </section>
      )}

      {step === "quote" && rec && (
        <QuoteView
          lang={lang}
          rec={rec.recommendation}
          cart={cart}
          setCart={setCart}
          onBack={() => setStep("recommendation")}
          onContinue={() => setStep("kyc")}
        />
      )}

      {step === "kyc" && (
        <Kyc lang={lang} onResult={onKycResult} onPlaceOrder={placeOrder} onBack={() => setStep("quote")} />
      )}

      {step === "done" && order && (
        <section className="card done">
          <h2>🎉 {tr("orderPlaced", lang)}</h2>
          <p>
            {tr("orderId", lang)}: <b>{order.id}</b>
          </p>
          <p>
            {tr("monthlyTotal", lang)}: <b>{formatInr(order.monthlyTotal)}</b> {tr("inclGst", lang)}
          </p>
          <p>
            {tr("readyIn", lang)} <b>{order.expectedActivationDays} {tr("days", lang)}</b>
          </p>
          <Link className="btn" href={`/track/${order.id}`}>
            {tr("trackOrder", lang)}
          </Link>
        </section>
      )}
    </main>
  );
}
