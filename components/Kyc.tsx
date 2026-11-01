"use client";

import { useRef, useState } from "react";
import type { StringKey } from "@/lib/i18n";
import ContactForm from "./ContactForm";
import { useI18n } from "./I18nProvider";
import type { DocType } from "@/lib/kyc/parse";
import type { KycCheck, KycResult } from "@/lib/kyc/verify";

const SLOTS: { slot: DocType; label: StringKey; file: string }[] = [
  { slot: "gst_certificate", label: "docGst", file: "gst_certificate" },
  { slot: "udyam_certificate", label: "docUdyam", file: "udyam_certificate" },
  { slot: "address_proof", label: "docBill", file: "address_proof" },
  { slot: "signatory_id", label: "docId", file: "signatory_id" },
];

const SAMPLES = Array.from({ length: 12 }, (_, i) => `K${String(i + 1).padStart(2, "0")}`);

interface DocState {
  name: string;
  preview: string;
  status: "reading" | "read" | "error";
  text?: string;
  progress?: number;
}

export interface KycOutcome {
  result: KycResult & { extracted?: { gstin?: string; signatory?: string } };
  canOrder: boolean;
}

interface Props {
  /** Context sent with a help request so the partner knows who is calling. */
  business: { businessType?: string; city?: string };
  onResult: (o: KycOutcome) => void;
  onPlaceOrder: () => void;
  onBack: () => void;
}

// One OCR worker per session, created lazily so the advisor loads fast.
type OcrWorker = { recognize: (img: string | File) => Promise<{ data: { text: string } }> };
let workerPromise: Promise<OcrWorker> | null = null;
function getWorker(onProgress: (p: number) => void): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(({ createWorker }) =>
      createWorker("eng", 1, {
        // Self-hosted engine and language data: documents are read on the device,
        // with no third-party CDN involved.
        workerPath: "/tesseract/worker.min.js",
        corePath: "/tesseract/core",
        langPath: "/tesseract/lang",
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") onProgress(m.progress);
        },
      }),
    ) as Promise<OcrWorker>;
  }
  return workerPromise;
}

const ICON: Record<KycCheck["status"], string> = { pass: "✅", warn: "⚠️", fail: "❌" };

export default function Kyc({ business, onResult, onPlaceOrder, onBack }: Props) {
  const { t, tt } = useI18n();
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [docs, setDocs] = useState<Partial<Record<DocType, DocState>>>({});
  const [result, setResult] = useState<
    | (KycResult & {
        wrongDoc?: { slot: DocType; detected: DocType }[];
        extracted?: { gstin?: string; udyam?: string; signatory?: string; billDate?: string };
      })
    | null
  >(null);
  const [checking, setChecking] = useState(false);
  const [helpForm, setHelpForm] = useState(false);
  const [helpSent, setHelpSent] = useState(false);
  const [helpBusy, setHelpBusy] = useState(false);
  const queue = useRef(Promise.resolve());

  const setDoc = (slot: DocType, patch: Partial<DocState>) =>
    setDocs((d) => ({ ...d, [slot]: { ...(d[slot] as DocState), ...patch } }));

  /** OCR runs here, in the browser. Only the extracted text is sent for checks. */
  function readDoc(slot: DocType, source: File | string, name: string) {
    const preview = typeof source === "string" ? source : URL.createObjectURL(source);
    setDocs((d) => ({ ...d, [slot]: { name, preview, status: "reading", progress: 0 } }));
    setResult(null);
    queue.current = queue.current.then(async () => {
      try {
        const worker = await getWorker((p) => setDoc(slot, { progress: p }));
        const { data } = await worker.recognize(source);
        setDoc(slot, { status: "read", text: data.text, progress: 1 });
      } catch {
        setDoc(slot, { status: "error" });
      }
    });
  }

  function loadSample(k: string) {
    if (!k) return;
    for (const s of SLOTS) {
      const url = `/kyc-samples/${k}_${s.file}.png`;
      fetch(url, { method: "HEAD" }).then((r) => {
        if (r.ok) readDoc(s.slot, url, `${k}_${s.file}.png`);
        else
          setDocs((d) => {
            const next = { ...d };
            delete next[s.slot];
            return next;
          });
      });
    }
  }

  async function verify() {
    setChecking(true);
    try {
      const res = await fetch("/api/kyc/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          consent: true,
          docs: SLOTS.filter((s) => docs[s.slot]?.text).map((s) => ({ slot: s.slot, text: docs[s.slot]!.text })),
        }),
      });
      const data = await res.json();
      setResult(data);
      // A cancelled or suspended GSTIN does not block the order: GST-only products are dropped instead.
      const blocking = (data.checks as KycCheck[]).filter((c) => c.status === "fail" && c.id !== "gstin_inactive");
      onResult({ result: data, canOrder: blocking.length === 0 });
    } finally {
      setChecking(false);
    }
  }

  if (!consent) {
    return (
      <section className="card">
        <h2>{t("consentTitle")}</h2>
        <ul className="consent">
          {(
            [
              ["consentWhyLabel", "consentWhy"],
              ["consentWhatLabel", "consentWhat"],
              ["consentHowLabel", "consentHow"],
              ["consentRetentionLabel", "consentRetention"],
              ["consentRightsLabel", "consentRights"],
            ] as const
          ).map(([label, body]) => (
            <li key={label}>
              <b>{t(label)}</b> {t(body)}
            </li>
          ))}
        </ul>
        <label className="toggle small">
          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
          {t("consentMarketing")}
        </label>
        <div className="row actions">
          <button className="btn btn-ghost" onClick={onBack}>
            {t("back")}
          </button>
          <button className="btn" onClick={() => setConsent(true)}>
            {t("consentAgree")}
          </button>
        </div>
      </section>
    );
  }

  const allRead = SLOTS.some((s) => docs[s.slot]) && SLOTS.every((s) => !docs[s.slot] || docs[s.slot]!.status !== "reading");
  const blocking = result?.checks.filter((c) => c.status === "fail" && c.id !== "gstin_inactive") ?? [];

  return (
    <section>
      <h2>{t("kycTitle")}</h2>
      <p className="muted small">{t("kycIntro")}</p>

      <label className="small sample">
        {t("sample")}{" "}
        <select defaultValue="" onChange={(e) => loadSample(e.target.value)}>
          <option value="">—</option>
          {SAMPLES.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>

      {SLOTS.map((s) => {
        const d = docs[s.slot];
        const checks = result?.checks.filter((c) => c.doc === s.slot) ?? [];
        const wrong = result?.wrongDoc?.find((w) => w.slot === s.slot);
        return (
          <div key={s.slot} className="card doc">
            <div className="doc-head">
              {d ? <img src={d.preview} alt="" className="thumb" /> : <div className="thumb empty">📄</div>}
              <div className="grow">
                <b>{t(s.label)}</b>
                <p className="small muted">
                  {!d && "—"}
                  {d?.status === "reading" && `${t("reading")} ${Math.round((d.progress ?? 0) * 100)}%`}
                  {d?.status === "read" && `${t("read")} ✓`}
                  {d?.status === "error" && t("ocrFailed")}
                </p>
              </div>
              <label className="btn btn-small">
                {d ? t("replace") : t("upload")}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readDoc(s.slot, f, f.name);
                  }}
                />
              </label>
            </div>
            {wrong && <p className="small fail">❌ {t("wrongDocument")}</p>}
            {checks.map((c) => (
              <p key={c.id} className={`small ${c.status}`}>
                {ICON[c.status]} {tt(c.message)}
              </p>
            ))}
          </div>
        );
      })}

      {result && (
        <div className={`card ${blocking.length ? "warn-card" : "ok-card"}`}>
          <b>{blocking.length ? t("kycNeedsAction") : t("kycApproved")}</b>
          {!result.gstinUsable && <p className="small">{t("gstProductsRemoved")}</p>}
        </div>
      )}

      <div className="row actions">
        <button className="btn btn-ghost" onClick={onBack}>
          {t("back")}
        </button>
        {!result || checking ? (
          <button className="btn" disabled={!allRead || checking} onClick={verify}>
            {checking ? t("checking") : t("verify")}
          </button>
        ) : blocking.length === 0 ? (
          <button className="btn" onClick={onPlaceOrder}>
            {t("placeOrder")}
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={() => setHelpForm(true)} disabled={helpForm}>
            {t("callMe")}
          </button>
        )}
      </div>
      {helpForm && !helpSent && (
        <ContactForm
          title={t("helpTitle")}
          submitLabel={t("requestHelp")}
          defaultName={result?.extracted?.signatory ?? ""}
          busy={helpBusy}
          onSubmit={async (contact) => {
            setHelpBusy(true);
            try {
              const res = await fetch("/api/requests", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  kind: "kyc_help",
                  contact,
                  business: { ...business, tradeName: result?.business?.tradeName },
                  reasons: blocking.map((c) => c.message.en),
                }),
              });
              if (res.ok) setHelpSent(true);
            } finally {
              setHelpBusy(false);
            }
          }}
        />
      )}
      {helpSent && <p className="card ok-card small">{t("callbackSent")}</p>}
    </section>
  );
}
