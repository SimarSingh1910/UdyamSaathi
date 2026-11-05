import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Back-office access for Accel staff: one passcode (ADMIN_PASSCODE) exchanged for
 * a signed, HTTP-only cookie. Enough for a prototype; production would use the
 * company's SSO with per-role access.
 */
export const ADMIN_COOKIE = "uds_admin";
const MAX_AGE_S = 12 * 60 * 60;

export function adminPasscode(): string {
  return process.env.ADMIN_PASSCODE || "accel-demo";
}

function sign(value: string): string {
  return createHmac("sha256", `uds:${adminPasscode()}`).update(value).digest("hex");
}

export function checkPasscode(input: unknown): boolean {
  if (typeof input !== "string") return false;
  const a = Buffer.from(sign(input));
  const b = Buffer.from(sign(adminPasscode()));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Cookie value: "<expiry>.<signature>". */
export function issueToken(): string {
  const exp = Date.now() + MAX_AGE_S * 1000;
  return `${exp}.${sign(`admin:${exp}`)}`;
}

export function cookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${secure}`;
}

export const clearCookieHeader = () => `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function isAdmin(req: Request): boolean {
  const raw = req.headers.get("cookie") ?? "";
  const token = raw
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = Buffer.from(sign(`admin:${exp}`));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const unauthorized = () =>
  new Response(JSON.stringify({ error: "Sign in to the Accel back office first." }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
