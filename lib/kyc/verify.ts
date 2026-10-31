import { DATASET_TODAY, loadDataset } from "../data";
import { lookupGstin, lookupUdyam } from "../registry";
import type { ParsedBill, ParsedGst, ParsedId, ParsedUdyam } from "./parse";

export type CheckStatus = "pass" | "warn" | "fail";
type Text = { en: string; hi: string };

export interface KycCheck {
  id: string;
  doc: "gst_certificate" | "udyam_certificate" | "address_proof" | "signatory_id";
  status: CheckStatus;
  message: Text;
}

export interface KycInput {
  gst?: ParsedGst;
  udyam?: ParsedUdyam;
  bill?: ParsedBill;
  id?: ParsedId;
}

export interface KycResult {
  decision: "approved" | "needs_action";
  /** False if the GSTIN is missing, invalid, cancelled or suspended: GST-only products must be removed. */
  gstinUsable: boolean;
  checks: KycCheck[];
  /** Fields confirmed from the registry, used to prefill the order. */
  business?: { legalName: string; tradeName: string; state: string };
}

/** Address proof must be no older than this. */
export const ADDRESS_PROOF_MAX_AGE_DAYS = 90;

const t = (en: string, hi: string): Text => ({ en, hi });

/** Lowercase, strip punctuation and spacing: OCR noise and formatting should not fail a match. */
export const normalize = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Same text after normalising, allowing ~1 OCR slip per 15 characters. */
export function sameText(a?: string, b?: string): boolean {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return levenshtein(x, y) <= Math.max(1, Math.floor(Math.max(x.length, y.length) / 15));
}

/** "Neha Kaur (Prop. Vindhya Tours & Travels)" -> { person: "Neha Kaur", business: "Vindhya Tours & Travels" } */
export function splitProprietor(legalName?: string): { person?: string; business?: string } {
  const m = (legalName ?? "").match(/^(.*?)\s*\(\s*prop\.?\s*(.*?)\s*\)\s*$/i);
  return m ? { person: m[1], business: m[2] } : {};
}

const daysBetween = (from: string, to: Date) =>
  Math.floor((to.getTime() - new Date(`${from}T00:00:00+05:30`).getTime()) / 86_400_000);

export function verifyKyc(input: KycInput, today: Date = DATASET_TODAY): KycResult {
  const checks: KycCheck[] = [];
  const add = (doc: KycCheck["doc"], id: string, status: CheckStatus, message: Text) =>
    checks.push({ id, doc, status, message });

  let gstinUsable = false;
  let registryTrade: string | undefined;
  let registryLegal: string | undefined;
  let registryAddress: string | undefined;
  let business: KycResult["business"];

  // ---- GST certificate -------------------------------------------------
  const gst = input.gst;
  if (!gst) {
    add("gst_certificate", "gst_missing", "fail", t(
      "Upload your GST registration certificate.",
      "अपना GST रजिस्ट्रेशन सर्टिफ़िकेट अपलोड करें।",
    ));
  } else if (!gst.gstin || !gst.legalName || !gst.tradeName) {
    add("gst_certificate", "gst_unreadable", "fail", t(
      "We could not read your GST certificate. The photo looks blurred or tilted. Retake it flat, in good light.",
      "GST सर्टिफ़िकेट पढ़ा नहीं जा सका। फ़ोटो धुंधली या टेढ़ी है। अच्छी रोशनी में सीधी फ़ोटो लें।",
    ));
  } else {
    const look = lookupGstin(gst.gstin);
    if (look.outcome === "invalid") {
      add("gst_certificate", "gstin_invalid", "fail", t(
        `The GSTIN on the certificate (${gst.gstin}) is not valid: ${look.message} It may be mistyped or altered.`,
        `सर्टिफ़िकेट पर GSTIN (${gst.gstin}) सही नहीं है। हो सकता है यह गलत लिखा या बदला गया हो।`,
      ));
    } else if (look.outcome === "not_found" || !look.record) {
      add("gst_certificate", "gstin_not_found", "fail", t(
        "This GSTIN is not in the GST registry.",
        "यह GSTIN GST रजिस्ट्री में नहीं मिला।",
      ));
    } else {
      const rec = look.record;
      if (rec.status === "Active") {
        gstinUsable = true;
        add("gst_certificate", "gstin_active", "pass", t(
          "GSTIN is valid and the registration is active.",
          "GSTIN सही है और रजिस्ट्रेशन एक्टिव है।",
        ));
      } else {
        add("gst_certificate", "gstin_inactive", "fail", t(
          `This GST registration is ${rec.status.toLowerCase()}. Products that need GST will be removed, or you can reactivate it on the GST portal.`,
          `यह GST रजिस्ट्रेशन ${rec.status === "Cancelled" ? "रद्द" : "निलंबित"} है। GST वाले प्रोडक्ट हटा दिए जाएंगे।`,
        ));
      }

      // Registry lookups return full names; the address stays masked to the client.
      const full = lookupFullGst(gst.gstin);
      registryLegal = full?.legalName;
      registryTrade = full?.tradeName;
      registryAddress = full?.address;
      business = full ? { legalName: full.legalName, tradeName: full.tradeName, state: full.state } : undefined;

      const namesOk = sameText(gst.legalName, registryLegal) && sameText(gst.tradeName, registryTrade);
      add("gst_certificate", "gst_names", namesOk ? "pass" : "fail", namesOk
        ? t("Names on the certificate match GST records.", "सर्टिफ़िकेट पर नाम GST रिकॉर्ड से मेल खाते हैं।")
        : t(
            `The name on the certificate ("${gst.legalName}") does not match GST records ("${registryLegal}"). The document may have been edited.`,
            `सर्टिफ़िकेट पर नाम ("${gst.legalName}") GST रिकॉर्ड ("${registryLegal}") से मेल नहीं खाता।`,
          ));

      if (gst.address && registryAddress) {
        const ok = sameText(gst.address, registryAddress);
        add("gst_certificate", "gst_address", ok ? "pass" : "warn", ok
          ? t("Business address matches GST records.", "पता GST रिकॉर्ड से मेल खाता है।")
          : t("The address on the certificate differs from GST records.", "सर्टिफ़िकेट का पता GST रिकॉर्ड से अलग है।"));
      }
    }
  }

  const businessName = registryTrade ?? input.gst?.tradeName;
  const gstAddress = registryAddress ?? input.gst?.address;

  // ---- Udyam certificate -----------------------------------------------
  const udyam = input.udyam;
  if (!udyam) {
    add("udyam_certificate", "udyam_missing", "fail", t(
      "Upload your Udyam registration certificate.",
      "अपना उद्यम रजिस्ट्रेशन सर्टिफ़िकेट अपलोड करें।",
    ));
  } else if (!udyam.udyamNumber) {
    add("udyam_certificate", "udyam_number_missing", "fail", t(
      "The Udyam number is missing or unreadable on the certificate. Upload the full certificate or type the number.",
      "सर्टिफ़िकेट पर उद्यम नंबर नहीं दिख रहा। पूरा सर्टिफ़िकेट अपलोड करें या नंबर टाइप करें।",
    ));
  } else {
    const look = lookupUdyam(udyam.udyamNumber);
    if (look.outcome !== "found" || !look.record) {
      add("udyam_certificate", "udyam_not_found", "fail", t(look.message, "यह उद्यम नंबर रजिस्ट्री में नहीं मिला।"));
    } else {
      const ok = sameText(look.record.enterpriseName, businessName ?? udyam.enterpriseName);
      add("udyam_certificate", "udyam_match", ok ? "pass" : "fail", ok
        ? t(`Udyam registration found: ${look.record.enterpriseType} enterprise.`, `उद्यम रजिस्ट्रेशन मिला: ${look.record.enterpriseType} उद्यम।`)
        : t(
            `The Udyam number belongs to "${look.record.enterpriseName}", not "${businessName}".`,
            `यह उद्यम नंबर "${look.record.enterpriseName}" का है, "${businessName}" का नहीं।`,
          ));
    }
  }

  // ---- Address proof ---------------------------------------------------
  const bill = input.bill;
  if (!bill) {
    add("address_proof", "bill_missing", "fail", t(
      "Upload a recent electricity bill as address proof.",
      "पते के सबूत के लिए हाल का बिजली बिल अपलोड करें।",
    ));
  } else if (!bill.billDate || !bill.address) {
    add("address_proof", "bill_unreadable", "fail", t(
      "We could not read your address proof. Retake the photo flat, in good light.",
      "पते का सबूत पढ़ा नहीं जा सका। अच्छी रोशनी में सीधी फ़ोटो लें।",
    ));
  } else {
    const age = daysBetween(bill.billDate, today);
    add("address_proof", "bill_recent", age <= ADDRESS_PROOF_MAX_AGE_DAYS && age >= 0 ? "pass" : "fail",
      age <= ADDRESS_PROOF_MAX_AGE_DAYS && age >= 0
        ? t(`Bill is ${age} days old.`, `बिल ${age} दिन पुराना है।`)
        : t(
            `This bill is dated ${bill.billDate}, ${age} days ago. Address proof must be from the last ${ADDRESS_PROOF_MAX_AGE_DAYS} days.`,
            `यह बिल ${bill.billDate} का है (${age} दिन पुराना)। पते का सबूत ${ADDRESS_PROOF_MAX_AGE_DAYS} दिन से ज़्यादा पुराना नहीं होना चाहिए।`,
          ));

    if (gstAddress) {
      const ok = sameText(bill.address, gstAddress);
      add("address_proof", "bill_address", ok ? "pass" : "fail", ok
        ? t("Supply address matches your GST address.", "बिल का पता GST पते से मेल खाता है।")
        : t("The address on the bill does not match your GST address.", "बिल का पता GST पते से मेल नहीं खाता।"));
    }
    if (businessName && bill.billedTo) {
      const ok = sameText(bill.billedTo, businessName) || sameText(bill.billedTo, registryLegal);
      add("address_proof", "bill_name", ok ? "pass" : "warn", ok
        ? t("Bill is in the business's name.", "बिल बिज़नेस के नाम पर है।")
        : t(`The bill is in the name of "${bill.billedTo}".`, `बिल "${bill.billedTo}" के नाम पर है।`));
    }
  }

  // ---- Signatory ID ----------------------------------------------------
  const id = input.id;
  if (!id) {
    add("signatory_id", "id_missing", "fail", t(
      "Upload the ID of the person signing for the business.",
      "बिज़नेस की ओर से साइन करने वाले व्यक्ति की ID अपलोड करें।",
    ));
  } else if (!id.name || !id.validTill) {
    add("signatory_id", "id_unreadable", "fail", t(
      "We could not read the signatory ID. Retake the photo.",
      "साइनेटरी ID पढ़ी नहीं जा सकी। फ़ोटो दोबारा लें।",
    ));
  } else {
    const expired = new Date(`${id.validTill}T23:59:59+05:30`) < today;
    add("signatory_id", "id_valid", expired ? "fail" : "pass", expired
      ? t(`This ID expired on ${id.validTill}.`, `यह ID ${id.validTill} को समाप्त हो चुकी है।`)
      : t(`ID is valid until ${id.validTill}.`, `ID ${id.validTill} तक मान्य है।`));

    if (businessName && id.business) {
      const ok = sameText(id.business, businessName);
      add("signatory_id", "id_business", ok ? "pass" : "fail", ok
        ? t("ID is issued for this business.", "ID इसी बिज़नेस के लिए है।")
        : t(`The ID is for "${id.business}", not "${businessName}".`, `यह ID "${id.business}" के लिए है, "${businessName}" के लिए नहीं।`));
    }

    // For a proprietorship only the proprietor can sign.
    const prop = splitProprietor(registryLegal ?? input.gst?.legalName);
    if (prop.person) {
      const ok = sameText(id.name, prop.person);
      add("signatory_id", "id_proprietor", ok ? "pass" : "fail", ok
        ? t("Signatory is the registered proprietor.", "साइनेटरी रजिस्टर्ड प्रोप्राइटर हैं।")
        : t(
            `For a proprietorship the proprietor (${prop.person}) must sign, but the ID is for ${id.name}.`,
            `प्रोप्राइटरशिप में प्रोप्राइटर (${prop.person}) को साइन करना होगा, लेकिन ID ${id.name} की है।`,
          ));
    }
  }

  return {
    decision: checks.some((c) => c.status === "fail") ? "needs_action" : "approved",
    gstinUsable,
    checks,
    business,
  };
}

// The public lookup masks the address; server-side checks need the full record.

function lookupFullGst(gstin: string) {
  const row = loadDataset("mock_gstin_registry").find((r) => r.gstin === gstin);
  return row
    ? {
        legalName: row.legal_name,
        tradeName: row.trade_name,
        address: row.principal_place_of_business,
        state: row.state,
      }
    : undefined;
}
