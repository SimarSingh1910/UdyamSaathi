import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { getDb, type Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { seedOnce } from "@/lib/db/seed";
import { encryptStore } from "@/lib/security/encryption";
import { createOrder, createRequest, getOrder, listProducts, type Order } from "@/lib/store";
import { checkCode, startVerification } from "@/lib/verify/phone";

const order = (id: string, phone: string): Order => ({
  id,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  status: "kyc_verified",
  lang: "en",
  business: { tradeName: "Test Traders", businessType: "Kirana store", segment: "micro", city: "Pune", sites: 1, employees: 2 },
  contact: { name: "Asha", phone },
  lines: [{ productId: "P01", name: "Biz Fibre 100", quantity: 1, unitPrice: 999, monthly: 999, installDays: 5, status: "pending" }],
  monthlyTotal: 1178.82,
  setupTotal: 0,
  contractMonths: 12,
  expectedActivationDays: 5,
  events: [],
});

async function freshDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db as unknown as Db;
}

describe("PostgreSQL store", () => {
  it("seeds the catalogue on first use", async () => {
    expect(await listProducts(true)).toHaveLength(25);
  });

  it("keeps phone numbers encrypted at rest and readable through the store", async () => {
    await createOrder(order("UDS-900001", "9876501234"));
    await createRequest({ kind: "callback", contact: { name: "Asha", phone: "9876505678" }, business: {}, reasons: [] });

    const db = await getDb();
    const [row] = await db.select().from(schema.orders).where(eq(schema.orders.id, "UDS-900001"));
    expect(row.contactPhone).not.toContain("9876501234");
    expect(row.contactPhone.startsWith("enc1:")).toBe(true);
    const requests = await db.select().from(schema.helpRequests);
    expect(requests.every((r) => !r.contactPhone.includes("98765"))).toBe(true);

    expect((await getOrder("UDS-900001"))!.contact.phone).toBe("9876501234");
  });

  it("counts every attempt when wrong codes arrive at the same time", async () => {
    const r = await startVerification({ phone: "9700000099", method: "whatsapp" });
    if (!r.ok) throw new Error(r.error);
    const results = await Promise.all(Array.from({ length: 10 }, () => checkCode(r.id, "000000" === r.demoCode ? "111111" : "000000")));
    expect(results.filter((x) => !x.ok && x.error === "wrong_code")).toHaveLength(4);
    expect(await checkCode(r.id, r.demoCode!)).toEqual({ ok: false, error: "too_many" });
  });
});

describe("moving from store.json", () => {
  it("imports an old encrypted store once, with phone tokens swapped back", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "uds-legacy-"));
    const file = path.join(dir, "store.json");
    const legacy = {
      data: {
        version: 1,
        products: [{ ...(await listProducts(true))[0], name: "Imported Fibre" }],
        orders: [{ ...order("UDS-800001", "ph_token1") }],
        requests: [],
        leadActions: { L0001: { status: "called", updatedAt: Date.now() } },
      },
      phoneVault: { ph_token1: "9811122233" },
    };
    writeFileSync(file, encryptStore(legacy));

    const before = process.env.UDYAM_STORE_PATH;
    process.env.UDYAM_STORE_PATH = file;
    try {
      const db = await freshDb();
      await seedOnce(db);
      await seedOnce(db); // second start: nothing happens

      const products = await db.select().from(schema.products);
      expect(products.map((p) => p.name)).toEqual(["Imported Fibre"]);
      const [o] = await db.select().from(schema.orders);
      expect(o.id).toBe("UDS-800001");
      const { orderFromRow } = await import("@/lib/db/rows");
      expect(orderFromRow(o).contact.phone).toBe("9811122233");
      expect(await db.select().from(schema.leadActions)).toHaveLength(1);
    } finally {
      process.env.UDYAM_STORE_PATH = before;
    }
  });

  it("seeds from the CSV when there is no old store", async () => {
    const db = await freshDb();
    await seedOnce(db);
    expect(await db.select().from(schema.products)).toHaveLength(25);
  });
});
