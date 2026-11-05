import { randomInt } from "node:crypto";
import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import type { Product } from "./catalogue";
import { getDb, type Db } from "./db";
import {
  addedLeadFromRow,
  addedLeadToRow,
  leadActionFromRow,
  leadActionToRow,
  orderFromRow,
  orderToRow,
  productFromRow,
  productToRow,
  requestFromRow,
  requestToRow,
  sessionFromData,
  sessionToData,
  verificationFromRow,
  verificationToRow,
} from "./db/rows";
import {
  helpRequests,
  hiddenLeads,
  leadActions as leadActionsTable,
  leads as leadsTable,
  orders,
  phoneVerifications,
  products,
  waSessions,
} from "./db/schema";
import { seedDemoOnce } from "./db/demo-seed";
import { seedOnce } from "./db/seed";
import { demoSite } from "./demo";
import type { LangCode } from "./languages";
import type { WaSession } from "./whatsapp/types";

/**
 * All persistent data goes through this module, backed by PostgreSQL (lib/db).
 * Routes and screens only see these functions and types, never SQL.
 */

export type OrderStatus = "placed" | "kyc_verified" | "scheduled" | "installing" | "active" | "cancelled";
export type LineStatus = "pending" | "installing" | "active";

export interface OrderLine {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  monthly: number;
  installDays: number;
  status: LineStatus;
}

export interface OrderEvent {
  at: number;
  status?: OrderStatus;
  note: { en: string; hi: string };
  by: "customer" | "system" | "accel";
}

export interface Order {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: OrderStatus;
  lang: LangCode;
  business: {
    tradeName: string;
    legalName?: string;
    gstinMasked?: string;
    businessType: string;
    segment: string;
    city: string;
    sites: number;
    employees: number;
  };
  contact: { name: string; phone: string };
  /** Where the owner placed the order. Older orders have none (web). */
  channel?: "web" | "whatsapp";
  lines: OrderLine[];
  monthlyTotal: number;
  setupTotal: number;
  contractMonths: number;
  expectedActivationDays: number;
  installSlot?: string;
  engineer?: string;
  /** Staff ID the customer can check when the engineer arrives. */
  engineerId?: string;
  events: OrderEvent[];
}

export type RequestStatus = "new" | "assigned" | "contacted" | "resolved";

/** An owner who could not finish on their own and asked for help. */
export interface HelpRequest {
  id: string;
  createdAt: number;
  updatedAt: number;
  kind: "kyc_help" | "callback";
  status: RequestStatus;
  contact: { name: string; phone: string };
  business: { tradeName?: string; businessType?: string; city?: string };
  reasons: string[];
  assignedTo?: string;
  note?: string;
}

export type LeadActionStatus = "to_call" | "called" | "won" | "not_interested";

export interface LeadAction {
  status: LeadActionStatus;
  assignedTo?: string;
  note?: string;
  updatedAt: number;
}

/** A lead added by Accel staff; data uses the smb_leads.csv column names. */
export interface AddedLead {
  id: string;
  createdAt: number;
  data: Record<string, string>;
  phone?: string;
}

export type VerifyMethod = "sms" | "voice" | "whatsapp" | "missed_call";

/** A pending or finished check that the owner really has the phone they gave us. */
export interface PhoneVerification {
  id: string;
  /** Keyed hash of the 10-digit number: the number itself is not kept here. */
  phoneHash: string;
  method: VerifyMethod;
  /** The code, hashed. Missed-call checks have none. */
  codeHash?: string;
  attempts: number;
  createdAt: number;
  expiresAt: number;
  verifiedAt?: number;
  /** WhatsApp chat waiting on this check, so the bot can carry on when it passes. */
  waSession?: string;
}

export interface StoredProduct extends Product {
  /** Hidden products stay in old orders but are not sold any more. */
  active: boolean;
}

// The first call in a process runs migrations (lib/db) and fills a new database once
// (plus sample back-office data on a demo site).
let ready: Promise<Db> | null = null;
function db(): Promise<Db> {
  if (!ready) {
    ready = getDb().then(async (d) => {
      await seedOnce(d);
      if (demoSite()) await seedDemoOnce(d);
      return d;
    });
    ready.catch(() => (ready = null));
  }
  return ready;
}

// ---- Products -----------------------------------------------------------

export async function listProducts(includeHidden = false): Promise<StoredProduct[]> {
  const rows = await (await db())
    .select()
    .from(products)
    .where(includeHidden ? undefined : eq(products.active, true))
    .orderBy(asc(products.id));
  return rows.map(productFromRow);
}

export async function upsertProduct(product: StoredProduct): Promise<StoredProduct> {
  const row = productToRow(product);
  const { id: _id, ...rest } = row;
  await (await db()).insert(products).values(row).onConflictDoUpdate({ target: products.id, set: rest });
  return product;
}

export async function deleteProduct(id: string): Promise<boolean> {
  return (await db()).transaction(async (tx) => {
    const gone = await tx.delete(products).where(eq(products.id, id)).returning({ id: products.id });
    if (!gone.length) return false;
    // Other products may depend on it; drop the dangling references.
    for (const p of await tx.select().from(products)) {
      if (p.requiresOneOf.includes(id)) {
        await tx
          .update(products)
          .set({ requiresOneOf: p.requiresOneOf.filter((x) => x !== id) })
          .where(eq(products.id, p.id));
      }
    }
    return true;
  });
}

export async function nextProductId(): Promise<string> {
  const ids = await (await db()).select({ id: products.id }).from(products);
  const n = Math.max(0, ...ids.map((p) => Number(p.id.replace(/\D/g, "")) || 0)) + 1;
  return `P${String(n).padStart(2, "0")}`;
}

// ---- Orders -------------------------------------------------------------

export async function listOrders(): Promise<Order[]> {
  const rows = await (await db()).select().from(orders).orderBy(desc(orders.createdAt));
  return rows.map(orderFromRow);
}

export async function getOrder(id: string): Promise<Order | undefined> {
  const [row] = await (await db()).select().from(orders).where(eq(orders.id, id));
  return row ? orderFromRow(row) : undefined;
}

export async function createOrder(order: Order): Promise<Order> {
  await (await db()).insert(orders).values(orderToRow(order));
  return order;
}

/** Read, change and save one order, locked so two staff edits can't overwrite each other. */
export async function updateOrder(id: string, fn: (o: Order) => void): Promise<Order | undefined> {
  return (await db()).transaction(async (tx) => {
    const [row] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!row) return undefined;
    const o = orderFromRow(row);
    fn(o);
    o.updatedAt = Date.now();
    const { id: _id, ...rest } = orderToRow(o);
    await tx.update(orders).set(rest).where(eq(orders.id, id));
    return o;
  });
}

export async function newOrderId(): Promise<string> {
  const d = await db();
  for (;;) {
    const id = `UDS-${randomInt(100000, 1000000)}`;
    const [taken] = await d.select({ id: orders.id }).from(orders).where(eq(orders.id, id));
    if (!taken) return id;
  }
}

// ---- Help requests ------------------------------------------------------

export async function listRequests(): Promise<HelpRequest[]> {
  const rows = await (await db()).select().from(helpRequests).orderBy(desc(helpRequests.createdAt));
  return rows.map(requestFromRow);
}

export async function getRequest(id: string): Promise<HelpRequest | undefined> {
  const [row] = await (await db()).select().from(helpRequests).where(eq(helpRequests.id, id));
  return row ? requestFromRow(row) : undefined;
}

export async function createRequest(
  r: Omit<HelpRequest, "id" | "createdAt" | "updatedAt" | "status">,
): Promise<HelpRequest> {
  const d = await db();
  for (;;) {
    const now = Date.now();
    const req: HelpRequest = { ...r, id: `REQ-${randomInt(100000, 1000000)}`, createdAt: now, updatedAt: now, status: "new" };
    const inserted = await d
      .insert(helpRequests)
      .values(requestToRow(req))
      .onConflictDoNothing()
      .returning({ id: helpRequests.id });
    if (inserted.length) return req;
  }
}

export async function updateRequest(
  id: string,
  patch: Partial<Pick<HelpRequest, "status" | "assignedTo" | "note">>,
): Promise<HelpRequest | undefined> {
  const set: Partial<typeof helpRequests.$inferInsert> = { updatedAt: new Date() };
  if (patch.status !== undefined) set.status = patch.status;
  if ("assignedTo" in patch) set.assignedTo = patch.assignedTo ?? null;
  if ("note" in patch) set.note = patch.note ?? null;
  const [row] = await (await db()).update(helpRequests).set(set).where(eq(helpRequests.id, id)).returning();
  return row ? requestFromRow(row) : undefined;
}

// ---- Leads: staff-added ones, and dataset ones that were deleted --------

export async function listAddedLeads(): Promise<AddedLead[]> {
  const rows = await (await db()).select().from(leadsTable).orderBy(desc(leadsTable.createdAt));
  return rows.map(addedLeadFromRow);
}

export async function getAddedLead(id: string): Promise<AddedLead | undefined> {
  const [row] = await (await db()).select().from(leadsTable).where(eq(leadsTable.id, id));
  return row ? addedLeadFromRow(row) : undefined;
}

export async function addLead(data: Record<string, string>, phone?: string): Promise<AddedLead> {
  const d = await db();
  for (;;) {
    const id = `LA${randomInt(100000, 1000000)}`;
    const lead: AddedLead = { id, createdAt: Date.now(), data: { ...data, lead_id: id }, phone };
    const inserted = await d.insert(leadsTable).values(addedLeadToRow(lead)).onConflictDoNothing().returning({ id: leadsTable.id });
    if (inserted.length) return lead;
  }
}

/** Added leads are removed; dataset leads are hidden, since the CSV is never changed. Follow-up notes go too. */
export async function deleteLead(id: string, inDataset: boolean): Promise<boolean> {
  return (await db()).transaction(async (tx) => {
    let found: boolean;
    if (inDataset) {
      await tx.insert(hiddenLeads).values({ leadId: id, hiddenAt: new Date() }).onConflictDoNothing();
      found = true;
    } else {
      found = (await tx.delete(leadsTable).where(eq(leadsTable.id, id)).returning({ id: leadsTable.id })).length > 0;
    }
    if (found) await tx.delete(leadActionsTable).where(eq(leadActionsTable.leadId, id));
    return found;
  });
}

export async function hiddenLeadIds(): Promise<Set<string>> {
  const rows = await (await db()).select({ id: hiddenLeads.leadId }).from(hiddenLeads);
  return new Set(rows.map((r) => r.id));
}

// ---- Actions on leads ----------------------------------------------------

export async function leadActions(): Promise<Record<string, LeadAction>> {
  const rows = await (await db()).select().from(leadActionsTable);
  return Object.fromEntries(rows.map((r) => [r.leadId, leadActionFromRow(r)]));
}

export async function setLeadAction(leadId: string, patch: Partial<LeadAction>): Promise<LeadAction> {
  return (await db()).transaction(async (tx) => {
    const [row] = await tx.select().from(leadActionsTable).where(eq(leadActionsTable.leadId, leadId)).for("update");
    const cur: LeadAction = row ? leadActionFromRow(row) : { status: "to_call", updatedAt: 0 };
    const next: LeadAction = { ...cur, ...patch, updatedAt: Date.now() };
    const values = leadActionToRow(leadId, next);
    const { leadId: _id, ...rest } = values;
    await tx.insert(leadActionsTable).values(values).onConflictDoUpdate({ target: leadActionsTable.leadId, set: rest });
    return next;
  });
}

// ---- Phone verification -------------------------------------------------

export async function addVerification(v: PhoneVerification): Promise<PhoneVerification> {
  const d = await db();
  // Old checks are only needed for rate limits; drop them after a day.
  await d.delete(phoneVerifications).where(lt(phoneVerifications.createdAt, new Date(Date.now() - 86_400_000)));
  await d.insert(phoneVerifications).values(verificationToRow(v));
  return v;
}

export async function getVerification(id: string): Promise<PhoneVerification | undefined> {
  const [row] = await (await db()).select().from(phoneVerifications).where(eq(phoneVerifications.id, id));
  return row ? verificationFromRow(row) : undefined;
}

/** Checks for one number started after `since` (epoch ms): for rate limits and missed calls. */
export async function recentVerifications(phoneHash: string, since: number): Promise<PhoneVerification[]> {
  const rows = await (await db())
    .select()
    .from(phoneVerifications)
    .where(and(eq(phoneVerifications.phoneHash, phoneHash), gt(phoneVerifications.createdAt, new Date(since))));
  return rows.map(verificationFromRow);
}

/** Read, change and save one check, locked so parallel code attempts are all counted. */
export async function updateVerification(
  id: string,
  fn: (v: PhoneVerification) => void,
): Promise<PhoneVerification | undefined> {
  return (await db()).transaction(async (tx) => {
    const [row] = await tx.select().from(phoneVerifications).where(eq(phoneVerifications.id, id)).for("update");
    if (!row) return undefined;
    const v = verificationFromRow(row);
    fn(v);
    const { id: _id, ...rest } = verificationToRow(v);
    await tx.update(phoneVerifications).set(rest).where(eq(phoneVerifications.id, id));
    return v;
  });
}

// ---- WhatsApp conversations ---------------------------------------------

export async function getWaSession(key: string): Promise<WaSession | undefined> {
  const [row] = await (await db()).select().from(waSessions).where(eq(waSessions.key, key));
  return row ? sessionFromData(row.data) : undefined;
}

export async function saveWaSession(session: WaSession): Promise<void> {
  const s = { ...session, updatedAt: Date.now() };
  const values = { key: s.key, data: sessionToData(s), updatedAt: new Date(s.updatedAt) };
  await (await db())
    .insert(waSessions)
    .values(values)
    .onConflictDoUpdate({ target: waSessions.key, set: { data: values.data, updatedAt: values.updatedAt } });
}

export async function deleteWaSession(key: string): Promise<void> {
  const d = await db();
  await d.delete(waSessions).where(eq(waSessions.key, key));
  await d.update(phoneVerifications).set({ waSession: null }).where(eq(phoneVerifications.waSession, key));
}
