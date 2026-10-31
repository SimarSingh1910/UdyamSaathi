import type { QuoteLine } from "./quote";

/**
 * Orders live on the owner's phone (localStorage) in this prototype. In production
 * they would sit in the order management system; the tracker only needs the
 * milestones below.
 */
export interface Order {
  id: string;
  createdAt: number;
  businessName: string;
  lines: Pick<QuoteLine, "productId" | "name" | "quantity" | "installDays">[];
  monthlyTotal: number;
  setupTotal: number;
  contractMonths: number;
  expectedActivationDays: number;
}

export type MilestoneKey = "placed" | "kyc" | "scheduled" | "installing" | "active";

export interface Milestone {
  key: MilestoneKey;
  label: { en: string; hi: string };
  /** Day offset from order creation when this milestone is reached. */
  day: number;
}

/** Order-level timeline derived from the slowest product's install time. */
export function milestones(order: Pick<Order, "expectedActivationDays">): Milestone[] {
  const d = Math.max(1, order.expectedActivationDays);
  return [
    { key: "placed", label: { en: "Order placed", hi: "ऑर्डर हुआ" }, day: 0 },
    { key: "kyc", label: { en: "KYC verified", hi: "KYC सत्यापित" }, day: 0 },
    { key: "scheduled", label: { en: "Installation slot booked", hi: "इंस्टॉलेशन का समय तय" }, day: Math.min(1, d) },
    { key: "installing", label: { en: "Engineer visit & setup", hi: "इंजीनियर विज़िट और सेटअप" }, day: Math.max(1, d - 1) },
    { key: "active", label: { en: "All services active", hi: "सभी सेवाएं चालू" }, day: d },
  ];
}

/** Per-product status at a given elapsed day. */
export function lineStatus(installDays: number, elapsedDays: number): "pending" | "installing" | "active" {
  if (elapsedDays >= installDays) return "active";
  if (elapsedDays >= Math.max(0, installDays - 1)) return "installing";
  return "pending";
}

const KEY = "udyamsaathi.orders";

export function saveOrder(order: Order) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    all[order.id] = order;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable: tracker will show "not found" */
  }
}

export function loadOrder(id: string): Order | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}")[id] ?? null;
  } catch {
    return null;
  }
}

export function newOrderId(): string {
  const n = Math.floor(Math.random() * 900000 + 100000);
  return `UDS-${n}`;
}
