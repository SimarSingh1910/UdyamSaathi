import { asc, eq } from "drizzle-orm";
import { segmentFor } from "../advisor";
import { loadDataset } from "../data";
import { STATUS_FLOW, STATUS_LABEL } from "../order-flow";
import { getModel, score } from "../propensity";
import { buildQuote } from "../quote";
import type { HelpRequest, LeadAction, Order, OrderEvent, OrderStatus } from "../store";
import type { Db } from "./index";
import { leadActionToRow, orderToRow, productFromRow, requestToRow } from "./rows";
import { appMeta, helpRequests, leadActions, orders, products } from "./schema";

const DAY = 24 * 60 * 60_000;
// Bump the version when sample data is added, so already-seeded databases get the
// new rows too (every insert skips rows that already exist).
const DEMO_SEED_KEY = "demo-seeded-v2";

interface SampleOrder {
  id: string;
  daysAgo: number;
  status: OrderStatus;
  tradeName: string;
  businessType: string;
  city: string;
  cityTier: 1 | 2;
  employees: number;
  sites: number;
  gstin: boolean;
  contact: [name: string, phone: string];
  lang: Order["lang"];
  channel: NonNullable<Order["channel"]>;
  items: [productId: string, quantity: number][];
  engineer?: string;
}

// Ten orders: every stage (two at the busy ones), across segments, cities and channels.
const SAMPLE_ORDERS: SampleOrder[] = [
  { id: "UDS-100109", daysAgo: 0.02, status: "placed", tradeName: "Om Sai Hardware", businessType: "Hardware store", city: "Nagpur", cityTier: 2, employees: 3, sites: 1, gstin: true, contact: ["Prakash Deshmukh", "9000000109"], lang: "mr", channel: "whatsapp", items: [["P04", 1], ["P07", 2], ["P19", 1]] },
  { id: "UDS-100110", daysAgo: 0.05, status: "placed", tradeName: "Rathi Logistics", businessType: "Transport company", city: "Indore", cityTier: 2, employees: 18, sites: 2, gstin: true, contact: ["Ankit Rathi", "9000000110"], lang: "hi", channel: "web", items: [["P01", 2], ["P25", 6], ["P08", 4]] },
  { id: "UDS-100101", daysAgo: 0.1, status: "kyc_verified", tradeName: "Shree Ganesh Kirana", businessType: "Kirana store", city: "Pune", cityTier: 1, employees: 2, sites: 1, gstin: false, contact: ["Ramesh Patil", "9000000101"], lang: "mr", channel: "whatsapp", items: [["P01", 1], ["P19", 1], ["P07", 1]] },
  { id: "UDS-100102", daysAgo: 0.6, status: "kyc_verified", tradeName: "Smile Care Dental", businessType: "Dental clinic", city: "Kochi", cityTier: 2, employees: 6, sites: 1, gstin: true, contact: ["Dr. Anjali Menon", "9000000102"], lang: "en", channel: "web", items: [["P02", 1], ["P12", 1], ["P16", 6]] },
  { id: "UDS-100103", daysAgo: 1.5, status: "scheduled", tradeName: "Annapurna Sweets", businessType: "Sweet shop", city: "Jaipur", cityTier: 2, employees: 4, sites: 1, gstin: true, contact: ["Suresh Agarwal", "9000000103"], lang: "hi", channel: "web", items: [["P01", 1], ["P23", 1], ["P19", 1]], engineer: "Vikram Singh" },
  { id: "UDS-100104", daysAgo: 2.2, status: "scheduled", tradeName: "Nair & Associates", businessType: "CA firm", city: "Bengaluru", cityTier: 1, employees: 12, sites: 1, gstin: true, contact: ["Priya Nair", "9000000104"], lang: "en", channel: "whatsapp", items: [["P02", 1], ["P16", 12], ["P20", 12]], engineer: "Arjun Rao" },
  { id: "UDS-100105", daysAgo: 4, status: "installing", tradeName: "Fresh Bake Cafe", businessType: "Bakery chain", city: "Hyderabad", cityTier: 1, employees: 25, sites: 3, gstin: true, contact: ["Imran Khan", "9000000105"], lang: "te", channel: "web", items: [["P02", 3], ["P22", 3], ["P19", 3]], engineer: "Ravi Teja" },
  { id: "UDS-100106", daysAgo: 9, status: "active", tradeName: "Lakshmi Medicals", businessType: "Pharmacy", city: "Chennai", cityTier: 1, employees: 3, sites: 1, gstin: true, contact: ["Karthik Subramanian", "9000000106"], lang: "ta", channel: "whatsapp", items: [["P01", 1], ["P19", 1]], engineer: "Senthil Kumar" },
  { id: "UDS-100107", daysAgo: 14, status: "active", tradeName: "Gupta Auto Components", businessType: "Auto-parts unit", city: "Ludhiana", cityTier: 2, employees: 40, sites: 1, gstin: true, contact: ["Harpreet Gupta", "9000000107"], lang: "pa", channel: "web", items: [["P02", 1], ["P23", 2], ["P20", 10]], engineer: "Gurdeep Singh" },
  { id: "UDS-100108", daysAgo: 6, status: "cancelled", tradeName: "Style Studio Salon", businessType: "Salon", city: "Lucknow", cityTier: 2, employees: 5, sites: 1, gstin: false, contact: ["Neha Verma", "9000000108"], lang: "hi", channel: "web", items: [["P04", 1], ["P22", 1]] },
];

const SAMPLE_REQUESTS: Omit<HelpRequest, "createdAt" | "updatedAt">[] = [
  { id: "REQ-100201", kind: "kyc_help", status: "new", contact: { name: "Mohammed Rafi", phone: "9000000201" }, business: { tradeName: "Rafi Mobile Repairs", businessType: "Mobile repair shop", city: "Kolkata" }, reasons: ["The name on the PAN does not match the GST certificate", "The GSTIN shows as cancelled"] },
  { id: "REQ-100202", kind: "callback", status: "assigned", assignedTo: "Pooja (Kolkata team)", contact: { name: "Sunita Desai", phone: "9000000202" }, business: { tradeName: "Little Stars Pre-school", businessType: "Pre-school chain", city: "Ahmedabad" }, reasons: ["Wants to talk through CCTV for 4 branches before ordering"] },
];

function sampleOrder(s: SampleOrder, catalogue: ReturnType<typeof productFromRow>[], now: number): Order | null {
  const quote = buildQuote(
    s.items.map(([productId, quantity]) => ({ productId, quantity })),
    { cityTier: s.cityTier, employees: s.employees, sites: s.sites, hasActiveGstin: s.gstin },
    catalogue,
  );
  if (!quote.ready) return null;
  const created = now - s.daysAgo * DAY;
  // The stages it went through, spread evenly between creation and now.
  const reached = s.status === "cancelled" ? ["placed", "kyc_verified"] : STATUS_FLOW.slice(0, STATUS_FLOW.indexOf(s.status) + 1);
  const stages = [...reached, ...(s.status === "cancelled" ? ["cancelled"] : [])] as OrderStatus[];
  const step = (now - created) / (stages.length + 1);
  const events: OrderEvent[] = stages.map((status, i) => ({
    at: Math.round(created + (i < 2 ? i * 60_000 : i * step)),
    status,
    note: status === "cancelled" ? { en: "Cancelled: the owner chose to wait", hi: "रद्द: मालिक ने रुकने का फ़ैसला किया" } : STATUS_LABEL[status],
    by: status === "placed" ? "customer" : status === "kyc_verified" ? "system" : "accel",
  }));
  const lineStatus = s.status === "active" ? "active" : s.status === "installing" ? "installing" : "pending";
  return {
    id: s.id,
    createdAt: Math.round(created),
    updatedAt: events[events.length - 1].at,
    status: s.status,
    lang: s.lang,
    business: {
      tradeName: s.tradeName,
      gstinMasked: s.gstin ? "27AAB*******1Z5" : undefined,
      businessType: s.businessType,
      segment: segmentFor({ businessType: s.businessType, sites: s.sites }),
      city: s.city,
      sites: s.sites,
      employees: s.employees,
    },
    contact: { name: s.contact[0], phone: s.contact[1] },
    channel: s.channel,
    lines: quote.lines.map((l) => ({
      productId: l.productId,
      name: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      monthly: l.monthly,
      installDays: l.installDays,
      status: lineStatus,
    })),
    monthlyTotal: quote.monthlyTotal,
    setupTotal: quote.setupTotal,
    contractMonths: quote.contractMonths,
    expectedActivationDays: quote.expectedActivationDays,
    installSlot: s.engineer ? new Date(created + 2 * DAY).toISOString().slice(0, 10) : undefined,
    engineer: s.engineer,
    engineerId: s.engineer ? `ENG-${s.id.slice(-4)}` : undefined,
    events,
  };
}

/** Follow-ups on the three best dropped leads, so the leads page shows work in progress. */
function sampleLeadActions(now: number): [string, LeadAction][] {
  const model = getModel();
  const best = loadDataset("smb_leads")
    .filter((r) => r.outcome !== "Activated" && r.drop_reason !== "Wrong or invalid number")
    .map((r) => ({ id: r.lead_id, p: score(model, r).probability }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 3);
  const actions: Omit<LeadAction, "updatedAt">[] = [
    { status: "won", assignedTo: "Arjun Rao", note: "Agreed to fibre + cloud telephony, order to follow" },
    { status: "called", assignedTo: "Pooja", note: "Asked for a callback next week after GST filing" },
    { status: "to_call", assignedTo: "Vikram Singh" },
  ];
  return best.map((l, i) => [l.id, { ...actions[i], updatedAt: now - (i + 1) * 3 * 60 * 60_000 }]);
}

/**
 * Demo site only: fills the back office once with sample orders, help requests and
 * lead follow-ups (orders UDS-1001xx, requests REQ-1002xx), so evaluators don't
 * open an empty screen. Claimed through app_meta like the first seed, so it runs
 * once per database, even with several servers.
 */
export async function seedDemoOnce(db: Db): Promise<void> {
  const added = await db.transaction(async (tx) => {
    const claimed = await tx
      .insert(appMeta)
      .values({ key: DEMO_SEED_KEY, value: "in progress", updatedAt: new Date() })
      .onConflictDoNothing()
      .returning();
    if (!claimed.length) return null;

    const now = Date.now();
    const catalogue = (await tx.select().from(products).orderBy(asc(products.id))).map(productFromRow);
    const sample = SAMPLE_ORDERS.map((s) => sampleOrder(s, catalogue, now)).filter((o): o is Order => Boolean(o));
    if (sample.length) await tx.insert(orders).values(sample.map(orderToRow)).onConflictDoNothing();
    await tx
      .insert(helpRequests)
      .values(SAMPLE_REQUESTS.map((r, i) => requestToRow({ ...r, createdAt: now - (i + 1) * 5 * 60 * 60_000, updatedAt: now - i * 60 * 60_000 })))
      .onConflictDoNothing();
    const actions = sampleLeadActions(now);
    if (actions.length) await tx.insert(leadActions).values(actions.map(([id, a]) => leadActionToRow(id, a))).onConflictDoNothing();

    await tx.update(appMeta).set({ value: `${sample.length} orders`, updatedAt: new Date() }).where(eq(appMeta.key, DEMO_SEED_KEY));
    return sample.length;
  });
  if (added !== null) console.info(`[db] demo site: added ${added} sample orders, ${SAMPLE_REQUESTS.length} help requests and lead follow-ups`);
}
