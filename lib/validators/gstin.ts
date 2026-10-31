/**
 * GSTIN format and checksum validation.
 *
 * Structure (15 chars):
 *   1-2   state code (01-38, plus 97 "Other Territory" and 99 "Centre Jurisdiction")
 *   3-12  PAN of the business (5 letters, 4 digits, 1 letter)
 *   13    entity number for the same PAN in that state (1-9, then A-Z)
 *   14    'Z' by default
 *   15    checksum (mod-36 Luhn variant over the first 14 chars)
 *
 * The 4th character of a real PAN is the holder type (P, C, F, ...). The hackathon
 * data always uses 'X' so no GSTIN can collide with a real taxpayer; we accept it.
 */

const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_PATTERN = /^(\d{2})([A-Z]{5}\d{4}[A-Z])([1-9A-Z])Z([0-9A-Z])$/;
const PAN_HOLDER_TYPES = new Set(["A", "B", "C", "F", "G", "H", "J", "L", "P", "T", "X"]);

export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

/** Compute the 15th (checksum) character for the first 14 characters of a GSTIN. */
export function gstinChecksum(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = CHARSET.indexOf(first14[i]);
    if (value < 0) throw new Error(`Invalid GSTIN character: ${first14[i]}`);
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36];
}

export type GstinError =
  | "empty"
  | "length"
  | "format"
  | "state_code"
  | "pan_holder_type"
  | "checksum";

export interface GstinValidation {
  valid: boolean;
  normalized: string;
  error?: GstinError;
  message?: string;
  stateCode?: string;
  state?: string;
  pan?: string;
}

/** Uppercase and strip spaces / dashes people often type in. */
export function normalizeGstin(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function validateGstin(input: string): GstinValidation {
  const normalized = normalizeGstin(input ?? "");
  const fail = (error: GstinError, message: string): GstinValidation => ({
    valid: false,
    normalized,
    error,
    message,
  });

  if (!normalized) return fail("empty", "Enter your 15-character GSTIN.");
  if (normalized.length !== 15) {
    return fail("length", `A GSTIN has 15 characters; this has ${normalized.length}.`);
  }

  const m = GSTIN_PATTERN.exec(normalized);
  if (!m) return fail("format", "This does not look like a GSTIN. Check it against your GST certificate.");

  const [, stateCode, pan] = m;
  if (!GST_STATE_CODES[stateCode]) return fail("state_code", `${stateCode} is not a valid GST state code.`);
  if (!PAN_HOLDER_TYPES.has(pan[3])) {
    return fail("pan_holder_type", "The PAN inside this GSTIN has an invalid holder type.");
  }
  if (gstinChecksum(normalized.slice(0, 14)) !== normalized[14]) {
    return fail("checksum", "The last character does not match. There may be a typo.");
  }

  return { valid: true, normalized, stateCode, state: GST_STATE_CODES[stateCode], pan };
}
