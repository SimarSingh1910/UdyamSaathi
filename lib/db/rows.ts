import { decryptValue, encryptValue } from "../security/encryption";
import type { WaSession } from "../whatsapp/types";
import type { HelpRequest, LeadAction, Order, PhoneVerification, StoredProduct } from "../store";
import type { SegmentCode } from "../catalogue";
import { helpRequests, leadActions, orders, phoneVerifications, products } from "./schema";

/** Conversions between the app's objects (epoch-ms times, plain phones) and table rows. */

type Row<T extends { $inferSelect: unknown }> = T["$inferSelect"];
type NewRow<T extends { $inferInsert: unknown }> = T["$inferInsert"];

const date = (ms: number) => new Date(ms);
const ms = (d: Date) => d.getTime();
const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

export const productFromRow = (r: Row<typeof products>): StoredProduct => ({
  ...r,
  targetSegments: r.targetSegments as SegmentCode[],
});

export const productToRow = (p: StoredProduct): NewRow<typeof products> => ({
  id: p.id,
  category: p.category,
  name: p.name,
  description: p.description,
  unit: p.unit,
  priceMin: p.priceMin,
  priceMax: p.priceMax,
  setupFee: p.setupFee,
  minContractMonths: p.minContractMonths,
  cityTiers: p.cityTiers,
  minEmployees: p.minEmployees,
  minSites: p.minSites,
  requiresGstin: p.requiresGstin,
  requiresOneOf: p.requiresOneOf,
  installDays: p.installDays,
  targetSegments: p.targetSegments,
  active: p.active,
});

export const orderFromRow = (r: Row<typeof orders>): Order => ({
  id: r.id,
  createdAt: ms(r.createdAt),
  updatedAt: ms(r.updatedAt),
  status: r.status as Order["status"],
  lang: r.lang as Order["lang"],
  channel: opt(r.channel) as Order["channel"],
  business: r.business as Order["business"],
  contact: { name: r.contactName, phone: decryptValue(r.contactPhone) },
  lines: r.lines,
  events: r.events,
  monthlyTotal: r.monthlyTotal,
  setupTotal: r.setupTotal,
  contractMonths: r.contractMonths,
  expectedActivationDays: r.expectedActivationDays,
  installSlot: opt(r.installSlot),
  engineer: opt(r.engineer),
});

export const orderToRow = (o: Order): NewRow<typeof orders> => ({
  id: o.id,
  createdAt: date(o.createdAt),
  updatedAt: date(o.updatedAt),
  status: o.status,
  lang: o.lang,
  channel: o.channel ?? null,
  business: o.business as unknown as Record<string, unknown>,
  contactName: o.contact.name,
  contactPhone: encryptValue(o.contact.phone),
  lines: o.lines,
  events: o.events,
  monthlyTotal: o.monthlyTotal,
  setupTotal: o.setupTotal,
  contractMonths: o.contractMonths,
  expectedActivationDays: o.expectedActivationDays,
  installSlot: o.installSlot ?? null,
  engineer: o.engineer ?? null,
});

export const requestFromRow = (r: Row<typeof helpRequests>): HelpRequest => ({
  id: r.id,
  createdAt: ms(r.createdAt),
  updatedAt: ms(r.updatedAt),
  kind: r.kind as HelpRequest["kind"],
  status: r.status as HelpRequest["status"],
  contact: { name: r.contactName, phone: decryptValue(r.contactPhone) },
  business: r.business,
  reasons: r.reasons,
  assignedTo: opt(r.assignedTo),
  note: opt(r.note),
});

export const requestToRow = (r: HelpRequest): NewRow<typeof helpRequests> => ({
  id: r.id,
  createdAt: date(r.createdAt),
  updatedAt: date(r.updatedAt),
  kind: r.kind,
  status: r.status,
  contactName: r.contact.name,
  contactPhone: encryptValue(r.contact.phone),
  business: r.business,
  reasons: r.reasons,
  assignedTo: r.assignedTo ?? null,
  note: r.note ?? null,
});

export const leadActionFromRow = (r: Row<typeof leadActions>): LeadAction => ({
  status: r.status as LeadAction["status"],
  assignedTo: opt(r.assignedTo),
  note: opt(r.note),
  updatedAt: ms(r.updatedAt),
});

export const leadActionToRow = (leadId: string, a: LeadAction): NewRow<typeof leadActions> => ({
  leadId,
  status: a.status,
  assignedTo: a.assignedTo ?? null,
  note: a.note ?? null,
  updatedAt: date(a.updatedAt),
});

export const verificationFromRow = (r: Row<typeof phoneVerifications>): PhoneVerification => ({
  id: r.id,
  phoneHash: r.phoneHash,
  method: r.method as PhoneVerification["method"],
  codeHash: opt(r.codeHash),
  attempts: r.attempts,
  createdAt: ms(r.createdAt),
  expiresAt: ms(r.expiresAt),
  verifiedAt: r.verifiedAt ? ms(r.verifiedAt) : undefined,
  waSession: opt(r.waSession),
});

export const verificationToRow = (v: PhoneVerification): NewRow<typeof phoneVerifications> => ({
  id: v.id,
  phoneHash: v.phoneHash,
  method: v.method,
  codeHash: v.codeHash ?? null,
  attempts: v.attempts,
  createdAt: date(v.createdAt),
  expiresAt: date(v.expiresAt),
  verifiedAt: v.verifiedAt ? date(v.verifiedAt) : null,
  waSession: v.waSession ?? null,
});

export const sessionFromData = (data: string): WaSession => JSON.parse(decryptValue(data)) as WaSession;
export const sessionToData = (s: WaSession): string => encryptValue(JSON.stringify(s));
