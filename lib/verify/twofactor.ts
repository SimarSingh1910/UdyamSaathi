import { maskPhone } from "../order-flow";

/**
 * 2Factor.in delivers our one-time codes by SMS or by a voice call that reads the
 * code out. We generate and check the code ourselves (lib/verify/phone.ts); 2Factor
 * only delivers it, through its "send this OTP" endpoints:
 *   GET https://2factor.in/API/V1/{api_key}/SMS/{phone}/{otp}[/{template}]
 *   GET https://2factor.in/API/V1/{api_key}/VOICE/{phone}/{otp}
 * Success looks like {"Status":"Success","Details":"<session id>"}.
 */

export type TwoFactorChannel = "SMS" | "VOICE";

const apiKey = () => process.env.TWOFACTOR_API_KEY?.trim() ?? "";

// The approved DLT template name. Without one, Indian operators block the SMS and
// 2Factor reads the code out in a call instead, so SMS is only offered with a template.
const smsTemplate = () => process.env.TWOFACTOR_SMS_TEMPLATE?.trim() ?? "";

export const twoFactorLive = () => Boolean(apiKey());
export const twoFactorSmsLive = () => twoFactorLive() && Boolean(smsTemplate());

export async function sendTwoFactorOtp(channel: TwoFactorChannel, phone: string, code: string): Promise<boolean> {
  const key = apiKey();
  if (!key) return false;
  const template = channel === "SMS" ? smsTemplate() : "";
  const parts = [key, channel, `91${phone}`, code, ...(template ? [template] : [])].map(encodeURIComponent);
  try {
    const res = await fetch(`https://2factor.in/API/V1/${parts.join("/")}`, { signal: AbortSignal.timeout(15_000) });
    const body = (await res.json().catch(() => null)) as { Status?: string; Details?: string } | null;
    const ok = res.ok && body?.Status === "Success";
    // Never log the key or the code; 2Factor's error text (e.g. "Invalid API Key") is safe.
    console.info(`[2factor] ${channel} to ${maskPhone(phone)} ${ok ? "sent" : `failed: ${res.status} ${body?.Details ?? ""}`}`);
    return ok;
  } catch (e) {
    console.warn(`[2factor] ${channel} to ${maskPhone(phone)} failed: ${(e as Error).message}`);
    return false;
  }
}
