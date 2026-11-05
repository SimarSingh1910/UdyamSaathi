import { describe, expect, it } from "vitest";
import { checkPasscode, isAdmin, issueToken } from "@/lib/auth";
import { getCatalogue } from "@/lib/catalogue";
import { scoredLeads } from "@/lib/leads";
import { applyLineStatus, applyStatus, maskPhone, nextStatus, normalizePhone, scheduleInstall } from "@/lib/order-flow";
import { parseProductInput } from "@/lib/product-input";
import { getModel } from "@/lib/propensity";
import {
  createOrder,
  deleteProduct,
  getOrder,
  listProducts,
  nextProductId,
  updateOrder,
  upsertProduct,
  type Order,
} from "@/lib/store";

function sampleOrder(id = "UDS-100001"): Order {
  return {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "kyc_verified",
    lang: "en",
    business: { tradeName: "Ganesh Woodcraft", businessType: "Furniture workshop", segment: "mfg", city: "Nagpur", sites: 1, employees: 5 },
    contact: { name: "Joseph Singh", phone: "9876543210" },
    lines: [
      { productId: "P01", name: "Biz Fibre 100", quantity: 1, unitPrice: 999, monthly: 999, installDays: 5, status: "pending" },
      { productId: "P07", name: "Business Postpaid 299", quantity: 2, unitPrice: 299, monthly: 598, installDays: 1, status: "pending" },
    ],
    monthlyTotal: 1884.46,
    setupTotal: 0,
    contractMonths: 12,
    expectedActivationDays: 5,
    events: [],
  };
}

describe("order lifecycle", () => {
  it("moves along the stages and logs every change", async () => {
    await createOrder(sampleOrder());
    await updateOrder("UDS-100001", (o) => scheduleInstall(o, "2026-11-03", "Ravi Kumar", "accel"));
    let o = (await getOrder("UDS-100001"))!;
    expect(o.status).toBe("scheduled");
    expect(o.engineer).toBe("Ravi Kumar");

    await updateOrder("UDS-100001", (x) => applyLineStatus(x, "P07", "active", "accel"));
    o = (await getOrder("UDS-100001"))!;
    expect(o.status).toBe("scheduled");

    await updateOrder("UDS-100001", (x) => applyLineStatus(x, "P01", "active", "accel"));
    o = (await getOrder("UDS-100001"))!;
    expect(o.status).toBe("active"); // every product active -> order active
    expect(o.events.map((e) => e.status).filter(Boolean)).toEqual(["scheduled", "active"]);
  });

  it("marks all products active when the order is activated", async () => {
    const o = sampleOrder("UDS-100002");
    applyStatus(o, "active", "accel");
    expect(o.lines.every((l) => l.status === "active")).toBe(true);
    expect(nextStatus("active")).toBeNull();
    expect(nextStatus("kyc_verified")).toBe("scheduled");
  });

  it("validates and masks Indian mobile numbers", async () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("09876543210")).toBe("9876543210");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("5876543210")).toBeNull();
    expect(maskPhone("9876543210")).toBe("98XXX XX210");
  });
});

describe("services catalogue", () => {
  const ids = async () => new Set((await listProducts(true)).map((p) => p.id));

  it("adds a new service that the quote engine can sell", async () => {
    const id = await nextProductId();
    expect(id).toBe("P26");
    const { product, errors } = parseProductInput(
      {
        name: "Smart Speaker for UPI",
        category: "IoT & Physical",
        unit: "per device",
        priceMin: 49,
        priceMax: 79,
        setupFee: 0,
        minContractMonths: 12,
        cityTiers: [1, 2],
        minEmployees: 1,
        minSites: 1,
        installDays: 1,
        targetSegments: ["micro"],
      },
      id,
      await ids(),
    );
    expect(errors).toEqual([]);
    await upsertProduct(product!);
    expect((await getCatalogue()).some((p) => p.id === "P26")).toBe(true);
  });

  it("rejects bad input", async () => {
    const { errors } = parseProductInput({ name: "", priceMin: 100, priceMax: 50, cityTiers: [], requiresOneOf: ["P99"] }, "P27", await ids());
    expect(errors.join(" ")).toMatch(/name is required/);
    expect(errors.join(" ")).toMatch(/priceMax/);
    expect(errors.join(" ")).toMatch(/city tier/);
    expect(errors.join(" ")).toMatch(/unknown dependency: P99/);
  });

  it("hides and deletes services, dropping dangling dependencies", async () => {
    const p26 = (await listProducts(true)).find((p) => p.id === "P26")!;
    await upsertProduct({ ...p26, active: false });
    expect((await getCatalogue()).some((p) => p.id === "P26")).toBe(false);
    expect((await listProducts(true)).some((p) => p.id === "P26")).toBe(true);

    await deleteProduct("P02");
    expect((await listProducts(true)).find((p) => p.id === "P11")!.requiresOneOf).toEqual(["P01", "P03"]);
  });
});

describe("lead score", () => {
  it("ranks leads better than chance on held-out data", async () => {
    const m = getModel();
    expect(m.holdoutAuc).toBeGreaterThan(0.65);
  });

  it("scores dropped leads with reasons, excluding unreachable numbers", async () => {
    const leads = await scoredLeads();
    expect(leads.length).toBeGreaterThan(4000);
    expect(leads.some((l) => l.dropReason === "Wrong or invalid number")).toBe(false);
    const top = [...leads].sort((a, b) => b.probability - a.probability)[0];
    expect(top.reasons.length).toBeGreaterThan(0);
  });
});

describe("back-office auth", () => {
  it("accepts only the passcode and a valid signed cookie", async () => {
    expect(checkPasscode("accel-demo")).toBe(true);
    expect(checkPasscode("guess")).toBe(false);
    const ok = new Request("http://x", { headers: { cookie: `uds_admin=${issueToken()}` } });
    const forged = new Request("http://x", { headers: { cookie: `uds_admin=${Date.now() + 1e6}.deadbeef` } });
    expect(isAdmin(ok)).toBe(true);
    expect(isAdmin(forged)).toBe(false);
    expect(isAdmin(new Request("http://x"))).toBe(false);
  });
});
