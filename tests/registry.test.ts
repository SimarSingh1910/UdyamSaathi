import { describe, expect, it } from "vitest";
import { loadDataset } from "@/lib/data";
import { lookupGstin, lookupUdyam } from "@/lib/registry";
import { gstinChecksum } from "@/lib/validators/gstin";

const gstRows = loadDataset("mock_gstin_registry");
const byStatus = (status: string) => gstRows.find((r) => r.status === status)!.gstin;

describe("GSTIN lookup", () => {
  it("returns an active record with the street address masked", () => {
    const res = lookupGstin("32TTNXB7384T1ZW");
    expect(res.outcome).toBe("found");
    expect(res.usableForKyc).toBe(true);
    expect(res.record?.legalName).toBe("Balaji Dental Care LLP");
    expect(res.record?.addressMasked).toBe("***, Kochi, Kerala - 289398");
    expect(res.record).not.toHaveProperty("address");
  });

  it("does not allow suspended or cancelled GSTINs for KYC", () => {
    for (const status of ["Suspended", "Cancelled"]) {
      const res = lookupGstin(byStatus(status));
      expect(res.outcome).toBe("found");
      expect(res.record?.status).toBe(status);
      expect(res.usableForKyc).toBe(false);
    }
  });

  it("separates invalid input from a valid GSTIN missing in the registry", () => {
    expect(lookupGstin("hello").outcome).toBe("invalid");
    // Valid structure and checksum, but not in the registry.
    const first14 = "07AAAXA0000A1Z";
    expect(lookupGstin(first14 + gstinChecksum(first14)).outcome).toBe("not_found");
  });
});

describe("Udyam lookup", () => {
  it("finds a registered enterprise", () => {
    const res = lookupUdyam("UDYAM-KL-00-3078801");
    expect(res.outcome).toBe("found");
    expect(res.record?.enterpriseName).toBe("Balaji Dental Care LLP");
    expect(res.record?.enterpriseType).toBe("Micro");
  });

  it("reports unknown numbers as not found", () => {
    expect(lookupUdyam("UDYAM-KL-00-0000000").outcome).toBe("not_found");
  });
});
