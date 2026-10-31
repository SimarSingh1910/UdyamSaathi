import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/kyc-ocr.json";
import { detectDocType, parseBill, parseGst, parseId, parseUdyam, repairGstin } from "@/lib/kyc/parse";
import { verifyKyc } from "@/lib/kyc/verify";

/** OCR text produced by tesseract.js from the 47 specimen documents (K01-K12). */
const ocr = fixtures as Record<string, string>;

function runApplicant(k: string) {
  const doc = (name: string) => ocr[`${k}_${name}`];
  return verifyKyc({
    gst: doc("gst_certificate") ? parseGst(doc("gst_certificate")) : undefined,
    udyam: doc("udyam_certificate") ? parseUdyam(doc("udyam_certificate")) : undefined,
    bill: doc("address_proof") ? parseBill(doc("address_proof")) : undefined,
    id: doc("signatory_id") ? parseId(doc("signatory_id")) : undefined,
  });
}

const failedChecks = (k: string) =>
  runApplicant(k)
    .checks.filter((c) => c.status === "fail")
    .map((c) => c.id);

describe("OCR parsing", () => {
  it("detects document types from their headings", () => {
    expect(detectDocType("Specimen: GST Registration Certificate")).toBe("gst_certificate");
    expect(detectDocType("Specimen: Electricity Bill\nBilled to X")).toBe("address_proof");
    expect(detectDocType("Specimen: Authorised Signatory ID\nValid till")).toBe("signatory_id");
  });

  it("repairs common OCR confusions in a GSTIN without forcing the checksum", () => {
    expect(repairGstin("27XUIXGO767D1ZP")).toBe("27XUIXG0767D1ZP"); // O -> 0 in a digit slot
    expect(repairGstin("24X0RXG9365M173")).toBe("24XORXG9365M1Z3"); // 0 -> O and 7 -> Z
  });

  it("joins addresses that OCR wrapped across lines", () => {
    const gst = parseGst(ocr.K01_gst_certificate);
    expect(gst.address).toBe("Shop/Unit 1, Tech Park Road, Visakhapatnam, Andhra Pradesh - 118383");
    expect(parseBill(ocr.K03_address_proof).address).toBe("Shop/Unit 80, Civil Lines, Nagpur, Maharashtra - 411231");
  });

  it("reads the signatory ID card layout (label and value on separate lines)", () => {
    expect(parseId(ocr.K01_signatory_id)).toMatchObject({
      name: "Neha Kaur",
      business: "Vindhya Tours & Travels",
      validTill: "2028-03-26",
    });
  });
});

describe("Smart KYC on the 12 specimen applicants", () => {
  it("approves applicants with clean documents", () => {
    for (const k of ["K03", "K08", "K09", "K12"]) {
      expect(runApplicant(k).decision, k).toBe("approved");
    }
  });

  it("K01: cancelled GSTIN and a Udyam certificate with no number", () => {
    expect(failedChecks("K01")).toEqual(["gstin_inactive", "udyam_number_missing"]);
    expect(runApplicant("K01").gstinUsable).toBe(false);
  });

  it("K02 and K04: GST certificate photo is too tilted or blurred to read", () => {
    expect(failedChecks("K02")).toEqual(["gst_unreadable"]);
    expect(failedChecks("K04")).toEqual(["gst_unreadable"]);
  });

  it("K05: Udyam certificate not uploaded", () => {
    expect(failedChecks("K05")).toEqual(["udyam_missing"]);
  });

  it("K06 and K10: GSTIN on the certificate fails the checksum", () => {
    expect(failedChecks("K06")).toEqual(["gstin_invalid"]);
    expect(failedChecks("K10")).toEqual(["gstin_invalid"]);
  });

  it("K07: legal name on the certificate was edited", () => {
    expect(failedChecks("K07")).toEqual(["gst_names"]);
  });

  it("K11: address proof older than 90 days", () => {
    expect(failedChecks("K11")).toEqual(["bill_recent"]);
  });

  it("catches a proprietorship signed by someone other than the proprietor", () => {
    const res = verifyKyc({
      gst: parseGst(ocr.K03_gst_certificate),
      udyam: parseUdyam(ocr.K03_udyam_certificate),
      bill: parseBill(ocr.K03_address_proof),
      id: { ...parseId(ocr.K03_signatory_id), name: "Someone Else" },
    });
    expect(res.checks.find((c) => c.id === "id_proprietor")?.status).toBe("fail");
  });

  it("catches an expired signatory ID", () => {
    const res = verifyKyc({
      gst: parseGst(ocr.K03_gst_certificate),
      udyam: parseUdyam(ocr.K03_udyam_certificate),
      bill: parseBill(ocr.K03_address_proof),
      id: { ...parseId(ocr.K03_signatory_id), validTill: "2026-01-31" },
    });
    expect(res.checks.find((c) => c.id === "id_valid")?.status).toBe("fail");
  });
});
