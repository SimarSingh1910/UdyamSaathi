/**
 * Turn OCR text from a KYC document into structured fields.
 *
 * OCR runs in the owner's browser (tesseract.js), so the image itself never
 * leaves the phone; only the extracted text is sent to the server for checks.
 */

export type DocType = "gst_certificate" | "udyam_certificate" | "address_proof" | "signatory_id";

export interface ParsedGst {
  type: "gst_certificate";
  gstinRaw?: string;
  gstin?: string;
  legalName?: string;
  tradeName?: string;
  constitution?: string;
  address?: string;
  liabilityDate?: string;
}

export interface ParsedUdyam {
  type: "udyam_certificate";
  udyamNumber?: string;
  enterpriseName?: string;
  majorActivity?: string;
  city?: string;
  state?: string;
  registrationDate?: string;
}

export interface ParsedBill {
  type: "address_proof";
  consumerNo?: string;
  billedTo?: string;
  address?: string;
  billDate?: string;
}

export interface ParsedId {
  type: "signatory_id";
  name?: string;
  designation?: string;
  business?: string;
  idNo?: string;
  validTill?: string;
}

export type ParsedDoc = ParsedGst | ParsedUdyam | ParsedBill | ParsedId;

/** Guess the document type from its heading, so a wrong upload is caught early. */
export function detectDocType(text: string): DocType | null {
  const t = text.toLowerCase();
  if (/gst\s*registration|gstin/.test(t)) return "gst_certificate";
  if (/udyam/.test(t)) return "udyam_certificate";
  if (/electricity|consumer\s*no|billed\s*to|supply\s*address/.test(t)) return "address_proof";
  if (/signatory|valid\s*till|designation/.test(t)) return "signatory_id";
  return null;
}

const cleanLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

/** Join a value that OCR split across two lines ("Visakhapatnam, A" + "ndhra Pradesh"). */
function joinWrapped(a: string, b: string): string {
  if (!b) return a;
  const end = a.at(-1) ?? "";
  const start = b[0];
  const glue = /[A-Za-z0-9]/.test(end) && /[A-Za-z0-9]/.test(start) ? "" : " ";
  return `${a}${glue}${b}`.replace(/\s*-\s*-?\s*/g, " - ").replace(/\s+/g, " ").trim();
}

/**
 * Value for a label: the rest of the line if there is any, otherwise the next line
 * (the ID card puts labels and values on separate lines).
 */
function valueAfter(lines: string[], label: RegExp): { value?: string; index: number } {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(label);
    if (m && m.index === 0) {
      const rest = lines[i].slice(m[0].length).replace(/^[\s:;,.]+/, "").trim();
      if (rest) return { value: rest, index: i };
      return { value: lines[i + 1], index: i + 1 };
    }
  }
  return { index: -1 };
}

/** Pull a YYYY-MM-DD date out of text that may contain OCR noise. */
export function parseDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(/(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})/);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return `${m[1]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const DIGIT_FOR: Record<string, string> = { O: "0", Q: "0", D: "0", I: "1", L: "1", Z: "2", S: "5", G: "6", B: "8" };
const LETTER_FOR: Record<string, string> = { "0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "7": "Z", "8": "B" };
const DIGIT_SLOTS = new Set([0, 1, 7, 8, 9, 10]);
const LETTER_SLOTS = new Set([2, 3, 4, 5, 6, 11]);

/**
 * Fix the usual OCR confusions (O/0, I/1, Z/7, S/5, B/8) using the GSTIN's fixed
 * structure: digits where digits must be, letters where letters must be, and
 * 'Z' in position 14. The checksum is NOT forced, so a genuinely wrong GSTIN
 * still fails validation.
 */
export function repairGstin(raw: string): string {
  const chars = raw.toUpperCase().replace(/[^0-9A-Z]/g, "").split("");
  if (chars.length !== 15) return chars.join("");
  return chars
    .map((ch, i) => {
      if (DIGIT_SLOTS.has(i)) return DIGIT_FOR[ch] ?? ch;
      if (LETTER_SLOTS.has(i)) return LETTER_FOR[ch] ?? ch;
      if (i === 13) return "Z";
      return ch;
    })
    .join("");
}

export function parseGst(text: string): ParsedGst {
  const lines = cleanLines(text);
  const gstinRaw = valueAfter(lines, /gstin/i).value?.split(" ")[0];
  const addr = valueAfter(lines, /address of principal/i);
  const cont = valueAfter(lines, /place of business/i);
  return {
    type: "gst_certificate",
    gstinRaw,
    gstin: gstinRaw ? repairGstin(gstinRaw) : undefined,
    legalName: valueAfter(lines, /legal name/i).value,
    tradeName: valueAfter(lines, /trade name/i).value,
    constitution: valueAfter(lines, /constitution/i).value,
    address: addr.value ? joinWrapped(addr.value, cont.value ?? "") : undefined,
    liabilityDate: parseDate(valueAfter(lines, /date of liability/i).value),
  };
}

export function parseUdyam(text: string): ParsedUdyam {
  const lines = cleanLines(text);
  const urnLine = valueAfter(lines, /udyam reg\.? number/i);
  // If the number is missing, the "next line" fallback would grab the next label.
  const urnMatch = (urnLine.value ?? "").toUpperCase().match(/UDYAM\s*-\s*[A-Z]{2}\s*-\s*\d{2}\s*-\s*\d{7}/);
  return {
    type: "udyam_certificate",
    udyamNumber: urnMatch ? urnMatch[0].replace(/\s/g, "") : undefined,
    enterpriseName: valueAfter(lines, /enterprise name/i).value,
    majorActivity: valueAfter(lines, /major activity/i).value,
    city: valueAfter(lines, /^city/i).value,
    state: valueAfter(lines, /^state/i).value,
    registrationDate: parseDate(valueAfter(lines, /date of registration/i).value),
  };
}

const LABEL_START = /^(bill date|units consumed|amount due|consumer no|billed to)/i;

export function parseBill(text: string): ParsedBill {
  const lines = cleanLines(text);
  const addr = valueAfter(lines, /supply address/i);
  let address = addr.value;
  const next = lines[addr.index + 1];
  if (address && next && !LABEL_START.test(next)) address = joinWrapped(address, next);
  return {
    type: "address_proof",
    consumerNo: valueAfter(lines, /consumer no\.?/i).value,
    billedTo: valueAfter(lines, /billed to/i).value,
    address,
    billDate: parseDate(valueAfter(lines, /bill date/i).value),
  };
}

export function parseId(text: string): ParsedId {
  const lines = cleanLines(text);
  return {
    type: "signatory_id",
    name: valueAfter(lines, /^name$/i).value,
    designation: valueAfter(lines, /^designation$/i).value,
    business: valueAfter(lines, /^for business$/i).value,
    idNo: valueAfter(lines, /^id no\.?$/i).value,
    validTill: parseDate(valueAfter(lines, /^valid till$/i).value),
  };
}

export function parseDocument(type: DocType, text: string): ParsedDoc {
  switch (type) {
    case "gst_certificate":
      return parseGst(text);
    case "udyam_certificate":
      return parseUdyam(text);
    case "address_proof":
      return parseBill(text);
    case "signatory_id":
      return parseId(text);
  }
}
