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
  it("moves along the stages and logs every change", () => {
    createOrder(sampleOrder());
    updateOrder("UDS-100001", (o) => scheduleInstall(o, "2026-11-03", "Ravi Kumar", "accel"));
    let o = getOrder("UDS-100001")!;
    expect(o.status).toBe("scheduled");
    expect(o.engineer).toBe("Ravi Kumar");

    updateOrder("UDS-100001", (x) => applyLineStatus(x, "P07", "active", "accel"));
    o = getOrder("UDS-100001")!;
    expect(o.status).toBe("scheduled");

    updateOrder("UDS-100001", (x) => applyLineStatus(x, "P01", "active", "accel"));
    o = getOrder("UDS-100001")!;
    expect(o.status).toBe("active"); // every product active -> order active
    expect(o.events.map((e) => e.status).filter(Boolean)).toEqual(["scheduled", "active"]);
  });

  it("marks all products active when the order is activated", () => {
    const o = sampleOrder("UDS-100002");
    applyStatus(o, "active", "accel");
    expect(o.lines.every((l) => l.status === "active")).toBe(true);
    expect(nextStatus("active")).toBeNull();
    expect(nextStatus("kyc_verified")).toBe("scheduled");
  });

  it("validates and masks Indian mobile numbers", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("09876543210")).toBe("9876543210");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("5876543210")).toBeNull();
    expect(maskPhone("9876543210")).toBe("98XXX XX210");
  });
});

describe("services catalogue", () => {
  const ids = () => new Set(listProducts(true).map((p) => p.id));

  it("adds a new service that the quote engine can sell", () => {
    const id = nextProductId();
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
      ids(),
    );
    expect(errors).toEqual([]);
    upsertProduct(product!);
    expect(getCatalogue().some((p) => p.id === "P26")).toBe(true);
  });

  it("rejects bad input", () => {
    const { errors } = parseProductInput({ name: "", priceMin: 100, priceMax: 50, cityTiers: [], requiresOneOf: ["P99"] }, "P27", ids());
    expect(errors.join(" ")).toMatch(/name is required/);
    expect(errors.join(" ")).toMatch(/priceMax/);
    expect(errors.join(" ")).toMatch(/city tier/);
    expect(errors.join(" ")).toMatch(/unknown dependency: P99/);
  });

  it("hides and deletes services, dropping dangling dependencies", () => {
    const p26 = listProducts(true).find((p) => p.id === "P26")!;
    upsertProduct({ ...p26, active: false });
    expect(getCatalogue().some((p) => p.id === "P26")).toBe(false);
    expect(listProducts(true).some((p) => p.id === "P26")).toBe(true);

    deleteProduct("P02");
    expect(listProducts(true).find((p) => p.id === "P11")!.requiresOneOf).toEqual(["P01", "P03"]);
  });
});

describe("lead score", () => {
  it("ranks leads better than chance on held-out data", () => {
    const m = getModel();
    expect(m.holdoutAuc).toBeGreaterThan(0.65);
  });

  it("scores dropped leads with reasons, excluding unreachable numbers", () => {
    const leads = scoredLeads();
    expect(leads.length).toBeGreaterThan(4000);
    expect(leads.some((l) => l.dropReason === "Wrong or invalid number")).toBe(false);
    const top = [...leads].sort((a, b) => b.probability - a.probability)[0];
    expect(top.reasons.length).toBeGreaterThan(0);
  });
});

describe("back-office auth", () => {
  it("accepts only the passcode and a valid signed cookie", () => {
    expect(checkPasscode("accel-demo")).toBe(true);
    expect(checkPasscode("guess")).toBe(false);
    const ok = new Request("http://x", { headers: { cookie: `uds_admin=${issueToken()}` } });
    const forged = new Request("http://x", { headers: { cookie: `uds_admin=${Date.now() + 1e6}.deadbeef` } });
    expect(isAdmin(ok)).toBe(true);
    expect(isAdmin(forged)).toBe(false);
    expect(isAdmin(new Request("http://x"))).toBe(false);
  });
});
