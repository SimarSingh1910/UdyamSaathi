"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { ActionId } from "@/lib/app-guide";
import type { AdvisorAnswers, Recommendation } from "@/lib/advisor";
import type { Product } from "@/lib/catalogue";
import { formatInr, type StringKey, type Text } from "@/lib/i18n";
import type { Quote } from "@/lib/quote";
import Advisor from "./Advisor";
import Assistant, { type AssistantContext } from "./Assistant";
import ContactForm from "./ContactForm";
import { useI18n } from "./I18nProvider";
import Kyc, { type KycOutcome } from "./Kyc";
import LanguagePicker, { LanguageGrid } from "./LanguagePicker";
import QuoteView, { type CartLine } from "./QuoteView";
import SpeakButton from "./SpeakButton";

type Step = "advisor" | "recommendation" | "quote" | "kyc" | "contact" | "done";

interface RecResponse {
  recommendation: Recommendation;
  quote: Quote;
  /** Written by the LLM in English and translated like the rest of the UI. */
  pitch: string | null;
  summary: Text;
}

const STEP_KEYS: StringKey[] = ["stepAdvisor", "stepQuote", "stepKyc", "stepDone"];

export default function Journey() {
  const { lang, t, tt, chosen, machineTranslated } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<Step>("advisor");
  const [advisorKey, setAdvisorKey] = useState(0);
  const [rec, setRec] = useState<RecResponse | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [kyc, setKyc] = useState<KycOutcome | null>(null);
  const [answers, setAnswers] = useState<AdvisorAnswers | null>(null);
  const [order, setOrder] = useState<{ id: string; monthlyTotal: number; days: number } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAdvisorDone = useCallback(
    async (answers: AdvisorAnswers) => {
      setError(null);
      setAnswers(answers);
      try {
        const res = await fetch("/api/advisor/recommend", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers }),
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
        setError(t("somethingWrong"));
      }
    },
    [t],
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

  async function placeOrder(contact: { name: string; phone: string }) {
    if (!rec) return;
    setPlacing(true);
    setError(null);
    try {
      const items = cart.filter((l) => l.on && l.quantity > 0).map(({ productId, quantity }) => ({ productId, quantity }));
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lang,
          answers,
          profile: rec.recommendation.profile,
          items,
          business: {
            tradeName: kyc?.result.business?.tradeName,
            legalName: kyc?.result.business?.legalName,
            gstinMasked: kyc?.result.extracted?.gstin,
          },
          contact,
          kycApproved: kyc?.canOrder === true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Order failed");
      const q = await (
        await fetch("/api/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profile: rec.recommendation.profile, items }),
        })
      ).json();
      setOrder({ id: data.id, monthlyTotal: q.monthlyTotal, days: q.expectedActivationDays });
      setStep("done");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPlacing(false);
    }
  }

  function restart() {
    setRec(null);
    setCart([]);
    setKyc(null);
    setOrder(null);
    setAnswers(null);
    setAdvisorKey((k) => k + 1);
    setStep("advisor");
  }

  // The help assistant appears once the questions are done (the advisor is a chat already).
  const assistantActions: ActionId[] = ["open_language", "talk_to_person"];
  if (rec && step !== "done") {
    if (step !== "recommendation") assistantActions.push("go_bundle");
    if (step !== "quote") assistantActions.push("go_quote");
    if (step === "quote" || step === "contact") assistantActions.push("go_kyc");
    assistantActions.push("start_over");
  }
  if (order) assistantActions.push("track_order");

  const blocking = kyc?.result.checks.filter((c) => c.status === "fail" && c.id !== "gstin_inactive") ?? [];
  const assistantContext: AssistantContext = {
    answers,
    profile: rec?.recommendation.profile,
    items: cart.filter((l) => l.on && l.quantity > 0).map(({ productId, quantity }) => ({ productId, quantity })),
    lines: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, on: l.on, core: l.core, why: l.why?.en })),
    skipped: rec?.recommendation.skipped.map((x) => ({ name: x.name, why: x.why.en })),
    kyc:
      step === "kyc" || step === "contact" || step === "done"
        ? { checked: !!kyc, approved: kyc?.canOrder === true, issues: blocking.map((c) => c.message.en) }
        : undefined,
    orderId: order?.id,
  };

  function onAssistantAction(a: ActionId) {
    if (a === "go_bundle") setStep("recommendation");
    else if (a === "go_quote") setStep("quote");
    else if (a === "go_kyc") setStep("kyc");
    else if (a === "start_over") restart();
    else if (a === "track_order" && order) router.push(`/track/${order.id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const stepIndex = { advisor: 0, recommendation: 0, quote: 1, kyc: 2, contact: 2, done: 3 }[step];

  return (
    <main>
      <header className="topbar">
        <Link href="/" className="brand">
          {t("appName")}
        </Link>
        <Link href="/" className="home-link">
          {t("demoHome")}
        </Link>
        <LanguagePicker />
      </header>

      {!chosen && step === "advisor" ? (
        <section>
          <h2>{t("chooseLanguage")}</h2>
          <LanguageGrid />
        </section>
      ) : (
        <>
      {machineTranslated && <p className="small muted mt-note">{t("machineTranslated")}</p>}

      <ol className="progress">
        {STEP_KEYS.map((k, i) => (
          <li key={k} className={i <= stepIndex ? "on" : ""}>
            {t(k)}
          </li>
        ))}
      </ol>

      {error && <p className="card warn-card small">{error}</p>}

      {step === "advisor" && <Advisor key={advisorKey} onDone={onAdvisorDone} />}

      {step === "recommendation" && rec && (
        <section>
          <div className="card pitch">
            <div className="row pitch-head">
              <span className="badge">{rec.pitch ? t("aiBadge") : t("advisorBadge")}</span>
              <SpeakButton text={tt(rec.pitch ?? rec.summary)} />
            </div>
            <p>{tt(rec.pitch ?? rec.summary)}</p>
          </div>
          <h3>{t("yourBundle")}</h3>
          {rec.recommendation.items.map((i) => {
            const line = rec.quote.lines.find((l) => l.productId === i.productId);
            return (
              <div className="item" key={i.productId}>
                <div className="item-head">
                  <span className="item-name">
                    {line?.name} {i.quantity > 1 && <span className="muted">× {i.quantity}</span>}
                  </span>
                  <span className="item-price">
                    {line ? `${formatInr(line.monthly)}${t("perMonth")}` : ""}
                  </span>
                </div>
                <p className="muted small">{tt(i.why)}</p>
              </div>
            );
          })}
          <div className="card total-inline">
            <span>{t("monthlyTotal")}</span>
            <strong>{formatInr(rec.quote.monthlyTotal)}</strong>
            <span className="muted small">{t("inclGst")}</span>
          </div>
          <div className="row actions">
            <button className="btn btn-ghost" onClick={restart}>
              {t("startOver")}
            </button>
            <button className="btn" onClick={() => setStep("quote")}>
              {t("seePrice")}
            </button>
          </div>
        </section>
      )}

      {step === "quote" && rec && (
        <QuoteView
          rec={rec.recommendation}
          cart={cart}
          setCart={setCart}
          onBack={() => setStep("recommendation")}
          onContinue={() => setStep("kyc")}
        />
      )}

      {step === "kyc" && (
        <Kyc
          business={{ businessType: answers?.businessType, city: answers?.city }}
          onResult={onKycResult}
          onPlaceOrder={() => setStep("contact")}
          onBack={() => setStep("quote")}
        />
      )}

      {step === "contact" && (
        <ContactForm
          title={t("contactTitle")}
          submitLabel={t("placeOrder")}
          defaultName={kyc?.result.extracted?.signatory ?? ""}
          busy={placing}
          onSubmit={placeOrder}
        />
      )}

      {step === "done" && order && (
        <section className="card done">
          <h2>🎉 {t("orderPlaced")}</h2>
          <p>
            {t("orderId")}: <b>{order.id}</b>
          </p>
          <p>
            {t("monthlyTotal")}: <b>{formatInr(order.monthlyTotal)}</b> {t("inclGst")}
          </p>
          <p>
            {t("readyIn")} <b>{order.days} {t("days")}</b>
          </p>
          <Link className="btn" href={`/track/${order.id}`}>
            {t("trackOrder")}
          </Link>
        </section>
      )}
        </>
      )}

      {step !== "advisor" && (
        <Assistant
          screen={step}
          actions={assistantActions}
          onAction={onAssistantAction}
          context={assistantContext}
          business={{ businessType: answers?.businessType, city: answers?.city }}
        />
      )}
    </main>
  );
}
