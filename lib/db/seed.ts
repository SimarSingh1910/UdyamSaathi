import { eq } from "drizzle-orm";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseProduct } from "../catalogue";
import { loadDataset } from "../data";
import { dataDir } from "../data-dir";
import { decryptStore, isEncryptedStore } from "../security/encryption";
import type { HelpRequest, LeadAction, Order, PhoneVerification, StoredProduct } from "../store";
import type { WaSession } from "../whatsapp/types";
import type { Db } from "./index";
import {
  leadActionToRow,
  orderToRow,
  productToRow,
  requestToRow,
  sessionToData,
  verificationToRow,
} from "./rows";
import { appMeta, helpRequests, leadActions, orders, phoneVerifications, products, waSessions } from "./schema";

/** The JSON store used before PostgreSQL. */
interface LegacyStore {
  products: StoredProduct[];
  orders: Order[];
  requests: HelpRequest[];
  leadActions: Record<string, LeadAction>;
  verifications?: PhoneVerification[];
  waSessions?: Record<string, WaSession>;
}

const legacyFile = () => process.env.UDYAM_STORE_PATH || path.join(dataDir(), "store.json");

/** Reads the old store.json (encrypted or plain), with phone tokens swapped back for numbers. */
function readLegacyStore(file: string): LegacyStore | null {
  if (!existsSync(file)) return null;
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  let data: LegacyStore;
  let vault: Record<string, string> = {};
  if (isEncryptedStore(parsed)) {
    const payload = decryptStore<{ data: LegacyStore; phoneVault?: Record<string, string> }>(
      parsed as { iv: string; tag: string; data: string },
    );
    data = payload.data;
    vault = payload.phoneVault ?? {};
  } else {
    data = parsed as LegacyStore;
  }
  if (!data || !Array.isArray(data.orders) || !Array.isArray(data.products)) {
    throw new Error(`Unrecognised store format in ${file}. It has not been imported or changed.`);
  }
  const restore = (p: string) => vault[p] ?? p;
  for (const o of data.orders) o.contact.phone = restore(o.contact.phone);
  for (const r of data.requests ?? []) r.contact.phone = restore(r.contact.phone);
  for (const s of Object.values(data.waSessions ?? {})) {
    s.waId = restore(s.waId);
    if (s.pendingPhone) s.pendingPhone = restore(s.pendingPhone);
  }
  return data;
}

/**
 * Fills a new database once: from an existing store.json if there is one (so no
 * orders are lost in the move to PostgreSQL), otherwise the catalogue from the CSV.
 * The "seeded" marker makes this run exactly once, even with several servers.
 */
export async function seedOnce(db: Db): Promise<void> {
  const file = legacyFile();
  const done = await db.transaction(async (tx) => {
    // Claim the job inside the transaction: if seeding fails, the claim is rolled back
    // too, and another server starting at the same time waits here and then skips.
    const claimed = await tx
      .insert(appMeta)
      .values({ key: "seeded", value: "in progress", updatedAt: new Date() })
      .onConflictDoNothing()
      .returning();
    if (!claimed.length) return null;

    const legacy = readLegacyStore(file);
    if (legacy) {
      if (legacy.products.length) await tx.insert(products).values(legacy.products.map(productToRow)).onConflictDoNothing();
      if (legacy.orders.length) await tx.insert(orders).values(legacy.orders.map(orderToRow)).onConflictDoNothing();
      if (legacy.requests?.length) await tx.insert(helpRequests).values(legacy.requests.map(requestToRow)).onConflictDoNothing();
      const actions = Object.entries(legacy.leadActions ?? {});
      if (actions.length) await tx.insert(leadActions).values(actions.map(([id, a]) => leadActionToRow(id, a))).onConflictDoNothing();
      if (legacy.verifications?.length) {
        await tx.insert(phoneVerifications).values(legacy.verifications.map(verificationToRow)).onConflictDoNothing();
      }
      const sessions = Object.values(legacy.waSessions ?? {});
      if (sessions.length) {
        await tx
          .insert(waSessions)
          .values(sessions.map((s) => ({ key: s.key, data: sessionToData(s), updatedAt: new Date(s.updatedAt) })))
          .onConflictDoNothing();
      }
    } else {
      const seed = loadDataset("product_catalogue").map((r) => productToRow({ ...parseProduct(r), active: true }));
      await tx.insert(products).values(seed).onConflictDoNothing();
    }
    const value = legacy ? `imported ${file}` : "catalogue csv";
    await tx.update(appMeta).set({ value, updatedAt: new Date() }).where(eq(appMeta.key, "seeded"));
    return legacy ?? "csv";
  });

  if (done === "csv") console.info("[db] seeded the catalogue from product_catalogue.csv");
  else if (done) {
    console.info(`[db] imported ${done.orders.length} orders and ${done.products.length} products from ${file} (the file is left as it was)`);
  }
}
