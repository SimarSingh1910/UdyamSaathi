import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseProduct, type Product } from "./catalogue";
import { loadDataset } from "./data";
import type { LangCode } from "./languages";
import { randomBytes } from "node:crypto";
import { decryptStore, encryptStore, isEncryptedStore } from "./security/encryption";

/**
 * Tiny persistent store for the prototype: one JSON file, read once and written
 * through on every change. Everything goes through the functions below, so it can
 * be swapped for Postgres without touching routes or screens.
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
  lines: OrderLine[];
  monthlyTotal: number;
  setupTotal: number;
  contractMonths: number;
  expectedActivationDays: number;
  installSlot?: string;
  engineer?: string;
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

export interface StoredProduct extends Product {
  /** Hidden products stay in old orders but are not sold any more. */
  active: boolean;
}

interface StoreData {
  version: 1;
  products: StoredProduct[];
  orders: Order[];
  requests: HelpRequest[];
  leadActions: Record<string, LeadAction>;
}

/** Folder that holds runtime data (the store and translation caches). */
export function dataDir(): string {
  return path.dirname(storePath());
}

function storePath(): string {
  if (process.env.UDYAM_STORE_PATH) return process.env.UDYAM_STORE_PATH;
  // Serverless file systems are read-only except the temp dir.
  const base = process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), ".data");
  return path.join(base, "store.json");
}

let cache: StoreData | null = null;
let phoneVault: Record<string, string> = {};

function seed(): StoreData {
  return {
    version: 1,
    products: loadDataset("product_catalogue").map((r) => ({ ...parseProduct(r), active: true })),
    orders: [],
    requests: [],
    leadActions: {},
  };
}

type DiskPayload = {
  data: StoreData;
  phoneVault: Record<string, string>;
};

function tokenise(data: StoreData): DiskPayload {
  const copy = structuredClone(data);
  const vault = { ...phoneVault };
  const phoneToToken = new Map(
    Object.entries(vault).map(([token, phone]) => [phone, token])
  );

  const protect = (phone: string) => {
    let token = phoneToToken.get(phone);
    if (!token) {
      token = `ph_${randomBytes(24).toString("hex")}`;
      vault[token] = phone;
      phoneToToken.set(phone, token);
    }
    return token;
  };

  for (const order of copy.orders) {
    order.contact.phone = protect(order.contact.phone);
  }
  for (const request of copy.requests) {
    request.contact.phone = protect(request.contact.phone);
  }

  return { data: copy, phoneVault: vault };
}

function detokenise(payload: DiskPayload): StoreData {
  phoneVault = payload.phoneVault ?? {};
  const data = payload.data;
  const restore = (phone: string) => phoneVault[phone] ?? phone;

  for (const order of data.orders ?? []) {
    order.contact.phone = restore(order.contact.phone);
  }
  for (const request of data.requests ?? []) {
    request.contact.phone = restore(request.contact.phone);
  }

  return data;
}

function load(): StoreData {
  if (cache) return cache;

  const file = storePath();

  if (existsSync(file)) {
    const raw = readFileSync(file, "utf8");

    // Do not silently reset the database if its contents are invalid.
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        `The UdyamSaathi database at ${file} is not valid JSON. It has not been overwritten. Restore your backup before continuing.`
      );
    }

    if (isEncryptedStore(parsed)) {
      const payload = decryptStore<DiskPayload>(parsed as {
        iv: string; tag: string; data: string;
      });
      cache = detokenise(payload);
      return cache;
    }

    // One-time migration from the previous plaintext JSON format.
    cache = parsed as StoreData;
    if (
      !cache ||
      cache.version !== 1 ||
      !Array.isArray(cache.orders) ||
      !Array.isArray(cache.requests)
    ) {
      cache = null;
      throw new Error("Unrecognised database format. Original file preserved.");
    }

    persist();
    return cache;
  }

  cache = seed();
  persist();
  return cache;
}

function persist() {
  if (!cache) throw new Error("Cannot save an unloaded database.");

  const file = storePath();
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  const payload = tokenise(cache);

  writeFileSync(tmp, encryptStore(payload), { mode: 0o600 });
  renameSync(tmp, file);
  phoneVault = payload.phoneVault;
}

/** Run a change against the store and save it. */
function mutate<T>(fn: (data: StoreData) => T): T {
  const data = load();
  const out = fn(data);
  persist();
  return out;
}

/** Forget the in-memory copy (tests). */
export function resetStoreCache() {
  cache = null;
  phoneVault = {};
}

// ---- Products -----------------------------------------------------------

export const listProducts = (includeHidden = false): StoredProduct[] =>
  load().products.filter((p) => includeHidden || p.active);

export function upsertProduct(product: StoredProduct): StoredProduct {
  return mutate((d) => {
    const i = d.products.findIndex((p) => p.id === product.id);
    if (i >= 0) d.products[i] = product;
    else d.products.push(product);
    return product;
  });
}

export function deleteProduct(id: string): boolean {
  return mutate((d) => {
    const before = d.products.length;
    d.products = d.products.filter((p) => p.id !== id);
    // Other products may depend on it; drop the dangling references.
    for (const p of d.products) p.requiresOneOf = p.requiresOneOf.filter((x) => x !== id);
    return d.products.length < before;
  });
}

export function nextProductId(): string {
  const n = Math.max(0, ...load().products.map((p) => Number(p.id.replace(/\D/g, "")) || 0)) + 1;
  return `P${String(n).padStart(2, "0")}`;
}

// ---- Orders -------------------------------------------------------------

export const listOrders = (): Order[] => [...load().orders].sort((a, b) => b.createdAt - a.createdAt);
export const getOrder = (id: string): Order | undefined => load().orders.find((o) => o.id === id);

export function createOrder(order: Order): Order {
  return mutate((d) => {
    d.orders.push(order);
    return order;
  });
}

export function updateOrder(id: string, fn: (o: Order) => void): Order | undefined {
  return mutate((d) => {
    const o = d.orders.find((x) => x.id === id);
    if (!o) return undefined;
    fn(o);
    o.updatedAt = Date.now();
    return o;
  });
}

export function newOrderId(): string {
  const taken = new Set(load().orders.map((o) => o.id));
  let id: string;
  do id = `UDS-${Math.floor(Math.random() * 900000 + 100000)}`;
  while (taken.has(id));
  return id;
}

// ---- Help requests ------------------------------------------------------

export const listRequests = (): HelpRequest[] => [...load().requests].sort((a, b) => b.createdAt - a.createdAt);

export function createRequest(r: Omit<HelpRequest, "id" | "createdAt" | "updatedAt" | "status">): HelpRequest {
  return mutate((d) => {
    const req: HelpRequest = {
      ...r,
      id: `REQ-${Math.floor(Math.random() * 900000 + 100000)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "new",
    };
    d.requests.push(req);
    return req;
  });
}

export function updateRequest(id: string, patch: Partial<Pick<HelpRequest, "status" | "assignedTo" | "note">>) {
  return mutate((d) => {
    const r = d.requests.find((x) => x.id === id);
    if (!r) return undefined;
    Object.assign(r, patch, { updatedAt: Date.now() });
    return r;
  });
}

// ---- Actions on dataset leads ------------------------------------------

export const leadActions = (): Record<string, LeadAction> => load().leadActions;

export function setLeadAction(leadId: string, patch: Partial<LeadAction>): LeadAction {
  return mutate((d) => {
    const cur = d.leadActions[leadId] ?? { status: "to_call" as const, updatedAt: 0 };
    d.leadActions[leadId] = { ...cur, ...patch, updatedAt: Date.now() };
    return d.leadActions[leadId];
  });
}
