import { maskGstin, maskUdyam } from "../mask";
import { detectDocType, parseDocument, type DocType, type ParsedDoc } from "./parse";
import { verifyKyc, type KycInput, type KycResult } from "./verify";

const KEY: Record<DocType, keyof KycInput> = {
  gst_certificate: "gst",
  udyam_certificate: "udyam",
  address_proof: "bill",
  signatory_id: "id",
};

export const DOC_TYPES = Object.keys(KEY) as DocType[];
export const isDocType = (x: unknown): x is DocType => typeof x === "string" && x in KEY;

export interface KycCheckOutcome extends KycResult {
  wrongDoc: { slot: DocType; detected: DocType }[];
  /** Masked identifiers and the few fields the order needs. */
  extracted: { gstin?: string; udyam?: string; signatory?: string; billDate?: string };
}

/**
 * Parses OCR text from up to 4 documents and checks them against each other and the
 * registries. Nothing is stored; only masked identifiers leave this function.
 */
export function checkKycDocs(docs: { slot: DocType; text: string }[]): KycCheckOutcome {
  const input: KycInput = {};
  const wrongDoc: KycCheckOutcome["wrongDoc"] = [];

  for (const d of docs.slice(0, 4)) {
    if (!d || !isDocType(d.slot) || typeof d.text !== "string") continue;
    const text = d.text.slice(0, 20_000);
    const detected = detectDocType(text);
    if (detected && detected !== d.slot) {
      wrongDoc.push({ slot: d.slot, detected });
      continue;
    }
    (input as Record<string, ParsedDoc>)[KEY[d.slot]] = parseDocument(d.slot, text);
  }

  const result = verifyKyc(input);

  // Log only masked identifiers and the outcome.
  console.info(
    `[kyc] gstin=${input.gst?.gstin ? maskGstin(input.gst.gstin) : "-"} udyam=${
      input.udyam?.udyamNumber ? maskUdyam(input.udyam.udyamNumber) : "-"
    } decision=${result.decision} fails=${result.checks.filter((c) => c.status === "fail").map((c) => c.id).join(",")}`,
  );

  return {
    ...result,
    wrongDoc,
    extracted: {
      gstin: input.gst?.gstin ? maskGstin(input.gst.gstin) : undefined,
      udyam: input.udyam?.udyamNumber ? maskUdyam(input.udyam.udyamNumber) : undefined,
      signatory: input.id?.name,
      billDate: input.bill?.billDate,
    },
  };
}

/** A cancelled or suspended GSTIN does not block the order: GST-only products are dropped instead. */
export const blockingChecks = (r: KycResult) => r.checks.filter((c) => c.status === "fail" && c.id !== "gstin_inactive");
