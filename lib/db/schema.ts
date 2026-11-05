import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { OrderEvent, OrderLine } from "../store";

/**
 * Tables. Phone numbers and WhatsApp conversations are encrypted per value
 * (lib/security/encryption.ts); verification checks keep only a keyed hash.
 * Generate migrations after changing this file: npm run db:generate
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  unit: text("unit").notNull(),
  priceMin: doublePrecision("price_min").notNull(),
  priceMax: doublePrecision("price_max").notNull(),
  setupFee: doublePrecision("setup_fee").notNull(),
  minContractMonths: integer("min_contract_months").notNull(),
  cityTiers: jsonb("city_tiers").$type<number[]>().notNull(),
  minEmployees: integer("min_employees").notNull(),
  minSites: integer("min_sites").notNull(),
  requiresGstin: boolean("requires_gstin").notNull(),
  requiresOneOf: jsonb("requires_one_of").$type<string[]>().notNull(),
  installDays: integer("install_days").notNull(),
  targetSegments: jsonb("target_segments").$type<string[]>().notNull(),
  /** Hidden products stay in old orders but are not sold any more. */
  active: boolean("active").notNull().default(true),
});

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
    status: text("status").notNull(),
    lang: text("lang").notNull(),
    channel: text("channel"),
    business: jsonb("business").$type<Record<string, unknown>>().notNull(),
    contactName: text("contact_name").notNull(),
    /** Encrypted. */
    contactPhone: text("contact_phone").notNull(),
    lines: jsonb("lines").$type<OrderLine[]>().notNull(),
    events: jsonb("events").$type<OrderEvent[]>().notNull(),
    monthlyTotal: doublePrecision("monthly_total").notNull(),
    setupTotal: doublePrecision("setup_total").notNull(),
    contractMonths: integer("contract_months").notNull(),
    expectedActivationDays: integer("expected_activation_days").notNull(),
    installSlot: text("install_slot"),
    engineer: text("engineer"),
  },
  (t) => [index("orders_created_at_idx").on(t.createdAt), index("orders_status_idx").on(t.status)],
);

export const helpRequests = pgTable(
  "help_requests",
  {
    id: text("id").primaryKey(),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    contactName: text("contact_name").notNull(),
    /** Encrypted. */
    contactPhone: text("contact_phone").notNull(),
    business: jsonb("business").$type<Record<string, string | undefined>>().notNull(),
    reasons: jsonb("reasons").$type<string[]>().notNull(),
    assignedTo: text("assigned_to"),
    note: text("note"),
  },
  (t) => [index("help_requests_created_at_idx").on(t.createdAt)],
);

export const leadActions = pgTable("lead_actions", {
  leadId: text("lead_id").primaryKey(),
  status: text("status").notNull(),
  assignedTo: text("assigned_to"),
  note: text("note"),
  updatedAt: ts("updated_at").notNull(),
});

/** Leads added by Accel staff, in the same column shape as smb_leads.csv. */
export const leads = pgTable(
  "leads",
  {
    id: text("id").primaryKey(),
    createdAt: ts("created_at").notNull(),
    data: jsonb("data").$type<Record<string, string>>().notNull(),
    /** Encrypted; optional. */
    contactPhone: text("contact_phone"),
  },
  (t) => [index("leads_created_at_idx").on(t.createdAt)],
);

/** Dataset leads that staff deleted: the CSV is never changed, so they are hidden instead. */
export const hiddenLeads = pgTable("hidden_leads", {
  leadId: text("lead_id").primaryKey(),
  hiddenAt: ts("hidden_at").notNull(),
});

export const phoneVerifications = pgTable(
  "phone_verifications",
  {
    id: text("id").primaryKey(),
    phoneHash: text("phone_hash").notNull(),
    method: text("method").notNull(),
    codeHash: text("code_hash"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: ts("created_at").notNull(),
    expiresAt: ts("expires_at").notNull(),
    verifiedAt: ts("verified_at"),
    waSession: text("wa_session"),
  },
  (t) => [index("phone_verifications_phone_idx").on(t.phoneHash, t.createdAt)],
);

export const waSessions = pgTable("wa_sessions", {
  /** Keyed hash of the WhatsApp number. */
  key: text("key").primaryKey(),
  /** The whole conversation state, encrypted: it holds the number and what the owner said. */
  data: text("data").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

/** One-off facts about this database, e.g. that the catalogue was seeded. */
export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: ts("updated_at").notNull(),
});
