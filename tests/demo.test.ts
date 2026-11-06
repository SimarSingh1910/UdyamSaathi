import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { seedDemoOnce } from "@/lib/db/demo-seed";
import { getOrder, leadActions, listOrders, listRequests } from "@/lib/store";

describe("demo site sample data", () => {
  it("fills the back office once with orders at every stage, requests and lead follow-ups", async () => {
    await listOrders(); // migrate and seed the catalogue first
    await seedDemoOnce(await getDb());
    await seedDemoOnce(await getDb());

    const sample = (await listOrders()).filter((o) => o.id.startsWith("UDS-1001"));
    expect(sample).toHaveLength(10);
    expect(new Set(sample.map((o) => o.status))).toEqual(
      new Set(["placed", "kyc_verified", "scheduled", "installing", "active", "cancelled"]),
    );
    for (const o of sample) {
      expect(o.lines.length).toBeGreaterThan(0);
      expect(o.monthlyTotal).toBeGreaterThan(0);
      expect(o.events.at(-1)?.status).toBe(o.status);
    }
    expect((await getOrder("UDS-100106"))?.lines.every((l) => l.status === "active")).toBe(true);
    expect((await listRequests()).filter((r) => r.id.startsWith("REQ-1002"))).toHaveLength(2);
    expect(Object.values(await leadActions()).map((a) => a.status)).toEqual(
      expect.arrayContaining(["won", "called", "to_call"]),
    );
  });
});
