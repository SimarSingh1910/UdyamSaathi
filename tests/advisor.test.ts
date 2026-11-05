import { describe, expect, it } from "vitest";
import { recommend, segmentFor, type AdvisorAnswers } from "@/lib/advisor";
import { parseByKeywords } from "@/lib/advisor-parse";
import { getCatalogue } from "@/lib/catalogue";
import { buildQuote } from "@/lib/quote";

const catalogue = await getCatalogue();

const base: AdvisorAnswers = {
  businessType: "Kirana store",
  city: "Lucknow",
  employees: 2,
  sites: 1,
  currentInternet: "Mobile hotspot",
  needs: ["billing", "whatsapp", "cctv"],
  hasGstin: true,
};

const ids = (a: AdvisorAnswers) => recommend(a, catalogue).items.map((i) => i.productId);
const quoteFor = (a: AdvisorAnswers) => {
  const rec = recommend(a, catalogue);
  return buildQuote(rec.items, rec.profile, catalogue);
};

describe("advisor", () => {
  it("treats a single-type business with several shops as multi-site", () => {
    expect(segmentFor({ businessType: "Kirana store", sites: 1 })).toBe("micro");
    expect(segmentFor({ businessType: "Bakery", sites: 3 })).toBe("multi");
    expect(segmentFor({ businessType: "Textile unit", sites: 3 })).toBe("mfg");
  });

  it("gives a kirana store fibre, mobile lines, billing, WhatsApp and CCTV", () => {
    expect(ids(base)).toEqual(["P01", "P07", "P19", "P15", "P23"]);
  });

  it("swaps WhatsApp for a website when there is no GSTIN, and says why", () => {
    const rec = recommend({ ...base, hasGstin: false }, catalogue);
    expect(rec.items.map((i) => i.productId)).toContain("P18");
    expect(rec.items.map((i) => i.productId)).not.toContain("P15");
    expect(rec.skipped[0].productId).toBe("P15");
    expect(rec.skipped[0].why.en).toMatch(/GST/);
  });

  it("every recommended bundle is ready to check out (eligible, dependencies met)", () => {
    const types = ["Kirana store", "Dental clinic", "Restaurant chain", "Auto-parts unit", "CA firm", "Gym chain"];
    for (const businessType of types) {
      for (const hasGstin of [true, false]) {
        for (const [employees, sites] of [[2, 1], [12, 1], [30, 4]]) {
          const q = quoteFor({
            ...base,
            businessType,
            hasGstin,
            employees,
            sites,
            city: "Pune",
            needs: ["billing", "whatsapp", "cctv", "email", "security", "backup_internet", "phone_line", "machines"],
          });
          expect(q.issues, `${businessType} gst=${hasGstin} ${employees}/${sites}`).toEqual([]);
          expect(q.ready).toBe(true);
        }
      }
    }
  });

  it("keeps a micro bundle close to what micro businesses actually pay (~Rs 2,500/month)", () => {
    const q = quoteFor({ ...base, needs: ["billing"] });
    expect(q.monthlySubtotal).toBeLessThan(3500);
  });

  it("gives a multi-site chain per-site fibre, failover and SD-WAN", () => {
    const got = ids({ ...base, businessType: "Restaurant chain", employees: 40, sites: 4, needs: [] });
    expect(got).toEqual(expect.arrayContaining(["P02", "P08", "P09", "P10"]));
  });

  it("gives a manufacturer with 10+ staff and GST a leased line", () => {
    expect(ids({ ...base, businessType: "Auto-parts unit", employees: 15, needs: [] })).toContain("P05");
    expect(ids({ ...base, businessType: "Auto-parts unit", employees: 15, hasGstin: false, needs: [] })).toContain("P02");
  });
});

describe("free-text parsing without an LLM", () => {
  it("understands an English description", () => {
    expect(
      parseByKeywords("I run 3 pharmacy shops in Pune with 12 staff, we use phone hotspot and want CCTV and billing"),
    ).toMatchObject({ businessType: "Pharmacy", city: "Pune", employees: 12, sites: 3, currentInternet: "Mobile hotspot" });
  });

  it("understands Hindi", () => {
    const res = parseByKeywords("मेरी लखनऊ में किराना दुकान है, ४ लोग काम करते हैं, कैमरा चाहिए");
    expect(res.businessType).toBe("Kirana store");
    expect(res.employees).toBe(4);
    expect(res.needs).toContain("cctv");
  });
});

describe("short spoken answers", () => {
  it("understands yes/no to the GST question in several languages", () => {
    expect(parseByKeywords("haan", "hasGstin").hasGstin).toBe(true);
    expect(parseByKeywords("हाँ", "hasGstin").hasGstin).toBe(true);
    expect(parseByKeywords("ஆம்", "hasGstin").hasGstin).toBe(true);
    expect(parseByKeywords("nahi", "hasGstin").hasGstin).toBe(false);
    expect(parseByKeywords("नहीं।", "hasGstin").hasGstin).toBe(false);
  });

  it("reads a bare number as the answer to the question on screen", () => {
    expect(parseByKeywords("5", "employees").employees).toBe(5);
    expect(parseByKeywords("teen", "sites").sites).toBe(3);
    expect(parseByKeywords("5", "city").employees).toBeUndefined();
  });

  it("understands a city or business said on its own", () => {
    expect(parseByKeywords("Pune", "city").city).toBe("Pune");
    expect(parseByKeywords("kirana ki dukaan", "businessType").businessType).toBe("Kirana store");
  });
});

it("finds a city written in Hindi", () => {
  expect(parseByKeywords("मेरी पुणे में किराना दुकान है").city).toBe("Pune");
});

it("treats Other types by their segment", () => {
  expect(segmentFor({ businessType: "Other manufacturing unit", sites: 1 })).toBe("mfg");
  expect(segmentFor({ businessType: "Other office", sites: 1 })).toBe("prof");
});

describe("keyword parser avoids false facts", () => {
  it("doesn't treat a question about fibre as using fibre", () => {
    expect(parseByKeywords("What's the difference between fibre and AirFiber?").currentInternet).toBeUndefined();
    expect(parseByKeywords("we use fibre broadband at the shop").currentInternet).toBe("Business broadband");
  });
  it("only records GST from a clear statement", () => {
    expect(parseByKeywords("क्या GST के बिना WhatsApp मिल सकता है?").hasGstin).toBeUndefined();
    expect(parseByKeywords("hamare paas GST number hai").hasGstin).toBe(true);
    expect(parseByKeywords("no GST yet").hasGstin).toBe(false);
  });
});
