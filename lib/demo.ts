/**
 * Demo site switches, for showing the prototype to evaluators:
 * - the home page shows the back-office passcode (hidden until the eye is tapped);
 * - a fixed phone code (PHONE_DEMO_CODE, default 123456) is accepted next to the
 *   real one, so a slow call never holds up a demo;
 * - the back office starts with sample orders, help requests and lead follow-ups.
 *
 * On in development; in production only with DEMO_MODE=1. Never turn it on for a
 * real launch: the passcode is on a public page and anyone can pass phone checks.
 */
export function demoSite(): boolean {
  const flag = process.env.DEMO_MODE?.trim().toLowerCase();
  if (flag === "1" || flag === "on" || flag === "true") return true;
  if (flag === "0" || flag === "off" || flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/** The phone code that always works on a demo site, or "" when it is off. */
export function fixedDemoCode(): string {
  if (!demoSite()) return "";
  const code = (process.env.PHONE_DEMO_CODE ?? "").replace(/\D/g, "");
  return code.length === 6 ? code : "123456";
}
