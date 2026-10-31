/**
 * Masking helpers so identifiers never appear in full in logs or API responses
 * that do not need them (DPDP Act: data minimisation).
 */

/** 07AAAXA1234A1Z5 -> 07AAA*******1Z5 (state + first 3 PAN chars + last 3 chars). */
export function maskGstin(gstin: string): string {
  if (gstin.length !== 15) return "*".repeat(gstin.length);
  return `${gstin.slice(0, 5)}${"*".repeat(7)}${gstin.slice(12)}`;
}

/** UDYAM-KL-00-3078801 -> UDYAM-KL-00-***8801 */
export function maskUdyam(urn: string): string {
  const m = /^(UDYAM-[A-Z]{2}-\d{2}-)(\d{3})(\d{4})$/.exec(urn);
  if (!m) return "*".repeat(urn.length);
  return `${m[1]}***${m[3]}`;
}

/** Keep the city, state and PIN, hide the street-level part of an address. */
export function maskAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length <= 2) return address;
  return ["***", ...parts.slice(-2)].join(", ");
}
