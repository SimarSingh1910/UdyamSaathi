import type { LineStatus, Order, OrderEvent, OrderStatus } from "./store";

type Text = { en: string; hi: string };

/** The happy path an order moves along. "cancelled" can happen from any open stage. */
export const STATUS_FLOW: OrderStatus[] = ["placed", "kyc_verified", "scheduled", "installing", "active"];

export const STATUS_LABEL: Record<OrderStatus, Text> = {
  placed: { en: "Order placed", hi: "ऑर्डर हुआ" },
  kyc_verified: { en: "KYC verified", hi: "KYC सत्यापित" },
  scheduled: { en: "Installation booked", hi: "इंस्टॉलेशन बुक" },
  installing: { en: "Engineer on site", hi: "इंजीनियर साइट पर" },
  active: { en: "All services active", hi: "सभी सेवाएं चालू" },
  cancelled: { en: "Cancelled", hi: "रद्द" },
};

export const LINE_LABEL: Record<LineStatus, Text> = {
  pending: { en: "Waiting", hi: "इंतज़ार" },
  installing: { en: "Installing", hi: "इंस्टॉल हो रहा है" },
  active: { en: "Active", hi: "चालू" },
};

export const isOpen = (s: OrderStatus) => s !== "active" && s !== "cancelled";

export function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = STATUS_FLOW.indexOf(s);
  return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
}

const event = (status: OrderStatus | undefined, note: Text, by: OrderEvent["by"]): OrderEvent => ({
  at: Date.now(),
  status,
  note,
  by,
});

/** Move an order to a stage, keeping product statuses and the event log consistent. */
export function applyStatus(o: Order, status: OrderStatus, by: OrderEvent["by"], extra?: Text) {
  if (o.status === status) return;
  o.status = status;
  if (status === "installing") {
    for (const l of o.lines) if (l.status === "pending") l.status = "installing";
  }
  if (status === "active") {
    for (const l of o.lines) l.status = "active";
  }
  o.events.push(event(status, extra ?? STATUS_LABEL[status], by));
}

/** Mark one product's status; the order becomes active once every product is. */
export function applyLineStatus(o: Order, productId: string, status: LineStatus, by: OrderEvent["by"]) {
  const line = o.lines.find((l) => l.productId === productId);
  if (!line || line.status === status) return;
  line.status = status;
  o.events.push(
    event(undefined, { en: `${line.name}: ${LINE_LABEL[status].en}`, hi: `${line.name}: ${LINE_LABEL[status].hi}` }, by),
  );
  if (o.lines.every((l) => l.status === "active")) applyStatus(o, "active", by);
  else if (status === "installing" && STATUS_FLOW.indexOf(o.status) < STATUS_FLOW.indexOf("installing")) {
    applyStatus(o, "installing", by);
  }
}

export function scheduleInstall(o: Order, date: string, engineer: string, by: OrderEvent["by"]) {
  o.installSlot = date;
  o.engineer = engineer || undefined;
  const when = new Date(`${date}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const whenHi = new Date(`${date}T00:00:00+05:30`).toLocaleDateString("hi-IN", { day: "numeric", month: "short" });
  const note = {
    en: `Installation booked for ${when}${engineer ? ` with ${engineer}` : ""}`,
    hi: `इंस्टॉलेशन ${whenHi} को${engineer ? `, इंजीनियर ${engineer}` : ""}`,
  };
  if (STATUS_FLOW.indexOf(o.status) < STATUS_FLOW.indexOf("scheduled")) applyStatus(o, "scheduled", by, note);
  else o.events.push(event(undefined, note, by));
}

/** Expected date for each stage, from order time and the slowest product's install days. */
export function expectedDays(o: Pick<Order, "expectedActivationDays">): Record<OrderStatus, number> {
  const d = Math.max(1, o.expectedActivationDays);
  return { placed: 0, kyc_verified: 0, scheduled: 1, installing: Math.max(1, d - 1), active: d, cancelled: 0 };
}

/** "98765 43210" -> "98XXX XX210": staff and logs see a masked number by default. */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `${d.slice(0, 2)}XXX XX${d.slice(7)}` : "XXXXXXXXXX";
}

/** Indian mobile numbers: 10 digits starting 6-9, optional +91 / 0 prefix. */
export function normalizePhone(input: string): string | null {
  const d = input.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}
