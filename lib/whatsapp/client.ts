import { randomBytes } from "node:crypto";
import { maskPhone } from "../order-flow";

/**
 * WhatsApp Business Cloud API (Meta). Without credentials the client runs in demo
 * mode: messages go to an in-memory outbox that the simulator at /whatsapp reads,
 * so the whole flow works on localhost.
 */

export interface Button {
  id: string;
  title: string;
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export type OutMessage =
  | { type: "text"; text: string }
  | { type: "buttons"; text: string; buttons: Button[] }
  | { type: "list"; text: string; button: string; rows: ListRow[] };

export function waConfig() {
  return {
    token: process.env.WHATSAPP_TOKEN ?? "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    appSecret: process.env.WHATSAPP_APP_SECRET ?? "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
    otpTemplate: process.env.WHATSAPP_OTP_TEMPLATE ?? "",
    otpTemplateLang: process.env.WHATSAPP_OTP_TEMPLATE_LANG || "en",
    apiVersion: process.env.WHATSAPP_API_VERSION || "v23.0",
  };
}

/** True when messages really go out through Meta. */
export const whatsappLive = () => {
  const c = waConfig();
  return Boolean(c.token && c.phoneNumberId);
};

/** True when one-time codes can be sent: needs an approved authentication template. */
export const whatsappOtpLive = () => whatsappLive() && Boolean(waConfig().otpTemplate);

// WhatsApp's limits for interactive messages.
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function payload(to: string, m: OutMessage): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to };
  if (m.type === "text") return { ...base, type: "text", text: { body: cut(m.text, 4096), preview_url: true } };
  if (m.type === "buttons") {
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: cut(m.text, 1024) },
        action: {
          buttons: m.buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id.slice(0, 256), title: cut(b.title, 20) } })),
        },
      },
    };
  }
  return {
    ...base,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: cut(m.text, 1024) },
      action: {
        button: cut(m.button, 20),
        sections: [
          {
            rows: m.rows.slice(0, 10).map((r) => ({
              id: r.id.slice(0, 200),
              title: cut(r.title, 24),
              ...(r.description ? { description: cut(r.description, 72) } : {}),
            })),
          },
        ],
      },
    },
  };
}

async function graph(path: string, body: unknown): Promise<boolean> {
  const c = waConfig();
  try {
    const res = await fetch(`https://graph.facebook.com/${c.apiVersion}/${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${c.token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`[whatsapp] ${path} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`[whatsapp] ${path} failed: ${(e as Error).message}`);
    return false;
  }
}

// ---- Demo outbox ---------------------------------------------------------

const outbox = new Map<string, OutMessage[]>();

/** Messages sent to a number in demo mode since the last call. */
export function drainOutbox(to: string): OutMessage[] {
  const msgs = outbox.get(to) ?? [];
  outbox.delete(to);
  return msgs;
}

// ---- Sending -------------------------------------------------------------

/** `to` is the WhatsApp id: country code and number, digits only. */
export async function sendMessage(to: string, m: OutMessage): Promise<boolean> {
  if (!whatsappLive()) {
    outbox.set(to, [...(outbox.get(to) ?? []), m]);
    return true;
  }
  return graph(`${waConfig().phoneNumberId}/messages`, payload(to, m));
}

/** One-time code via the approved authentication template (body {{1}} + copy-code button). */
export async function sendOtpTemplate(to: string, code: string): Promise<boolean> {
  const c = waConfig();
  if (!whatsappOtpLive()) return false;
  const ok = await graph(`${c.phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: c.otpTemplate,
      language: { code: c.otpTemplateLang },
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
      ],
    },
  });
  console.info(`[whatsapp] otp to ${maskPhone(to)} ${ok ? "sent" : "failed"}`);
  return ok;
}

export async function markRead(messageId: string): Promise<void> {
  if (!whatsappLive()) return;
  await graph(`${waConfig().phoneNumberId}/messages`, { messaging_product: "whatsapp", status: "read", message_id: messageId });
}

// ---- Media ---------------------------------------------------------------

const demoMedia = new Map<string, { data: Buffer; mime: string }>();

/** Simulator uploads: kept in memory for a few minutes, then dropped. */
export function putDemoMedia(data: Buffer, mime: string): string {
  const id = `demo_${randomBytes(8).toString("hex")}`;
  demoMedia.set(id, { data, mime });
  setTimeout(() => demoMedia.delete(id), 10 * 60_000).unref?.();
  return id;
}

/** Downloads a photo the owner sent. Media URLs from Meta need the token and expire quickly. */
export async function downloadMedia(mediaId: string): Promise<{ data: Buffer; mime: string } | null> {
  const demo = demoMedia.get(mediaId);
  if (demo) {
    demoMedia.delete(mediaId);
    return demo;
  }
  if (!whatsappLive()) return null;
  const c = waConfig();
  const auth = { authorization: `Bearer ${c.token}` };
  try {
    const meta = await fetch(`https://graph.facebook.com/${c.apiVersion}/${mediaId}`, { headers: auth, signal: AbortSignal.timeout(15_000) });
    if (!meta.ok) return null;
    const { url, mime_type } = (await meta.json()) as { url?: string; mime_type?: string };
    if (!url) return null;
    const file = await fetch(url, { headers: auth, signal: AbortSignal.timeout(30_000) });
    if (!file.ok) return null;
    const data = Buffer.from(await file.arrayBuffer());
    // Same cap as voice notes: a document photo is far smaller.
    if (data.length > 10 * 1024 * 1024) return null;
    return { data, mime: mime_type ?? "application/octet-stream" };
  } catch {
    return null;
  }
}
