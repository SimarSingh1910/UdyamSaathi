/**
 * Udyam Registration Number (URN) validation.
 *
 * Format: UDYAM-<state>-<district>-<7 digits>, e.g. UDYAM-KL-00-3078801.
 * The hackathon data uses district code 00, which does not exist in reality,
 * so no URN can collide with a real enterprise. We accept any 2-digit district.
 */

const UDYAM_PATTERN = /^UDYAM-([A-Z]{2})-(\d{2})-(\d{7})$/;

export const UDYAM_STATE_CODES: Record<string, string> = {
  AN: "Andaman and Nicobar Islands",
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
  CG: "Chhattisgarh",
  CH: "Chandigarh",
  DL: "Delhi",
  DN: "Dadra and Nagar Haveli and Daman and Diu",
  GA: "Goa",
  GJ: "Gujarat",
  HP: "Himachal Pradesh",
  HR: "Haryana",
  JH: "Jharkhand",
  JK: "Jammu and Kashmir",
  KL: "Kerala",
  KR: "Karnataka",
  LA: "Ladakh",
  LD: "Lakshadweep",
  MH: "Maharashtra",
  ML: "Meghalaya",
  MN: "Manipur",
  MP: "Madhya Pradesh",
  MZ: "Mizoram",
  NL: "Nagaland",
  OD: "Odisha",
  PB: "Punjab",
  PY: "Puducherry",
  RJ: "Rajasthan",
  SK: "Sikkim",
  TN: "Tamil Nadu",
  TR: "Tripura",
  TS: "Telangana",
  UK: "Uttarakhand",
  UP: "Uttar Pradesh",
  WB: "West Bengal",
};

export type UdyamError = "empty" | "format" | "state_code";

export interface UdyamValidation {
  valid: boolean;
  normalized: string;
  error?: UdyamError;
  message?: string;
  stateCode?: string;
  state?: string;
}

/** Uppercase, trim and turn spaces / underscores into the dashes the format uses. */
export function normalizeUdyam(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

export function validateUdyam(input: string): UdyamValidation {
  const normalized = normalizeUdyam(input ?? "");
  const fail = (error: UdyamError, message: string): UdyamValidation => ({
    valid: false,
    normalized,
    error,
    message,
  });

  if (!normalized) return fail("empty", "Enter your Udyam Registration Number.");

  const m = UDYAM_PATTERN.exec(normalized);
  if (!m) {
    return fail("format", "A Udyam number looks like UDYAM-XX-00-1234567. Check your Udyam certificate.");
  }

  const stateCode = m[1];
  if (!UDYAM_STATE_CODES[stateCode]) return fail("state_code", `${stateCode} is not a valid state code.`);

  return { valid: true, normalized, stateCode, state: UDYAM_STATE_CODES[stateCode] };
}
