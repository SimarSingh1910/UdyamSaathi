import { describe, expect, it } from "vitest";
import { loadDataset } from "@/lib/data";
import { maskAddress, maskGstin, maskUdyam } from "@/lib/mask";
import { gstinChecksum, validateGstin } from "@/lib/validators/gstin";
import { validateUdyam } from "@/lib/validators/udyam";

describe("GSTIN validator", () => {
  it("accepts every GSTIN in the mock registry", () => {
    const rows = loadDataset("mock_gstin_registry");
    const invalid = rows.filter((r) => !validateGstin(r.gstin).valid);
    expect(rows.length).toBeGreaterThan(3000);
    expect(invalid).toEqual([]);
  });

  it("normalises case and spaces", () => {
    const res = validateGstin(" 32ttnxb7384t1zw ");
    expect(res.valid).toBe(true);
    expect(res.normalized).toBe("32TTNXB7384T1ZW");
    expect(res.state).toBe("Kerala");
  });

  it("catches a single-character typo through the checksum", () => {
    const res = validateGstin("32TTNXB7385T1ZW");
    expect(res.valid).toBe(false);
    expect(res.error).toBe("checksum");
  });

  it("rejects wrong length, bad format and unknown state codes", () => {
    expect(validateGstin("32TTNXB7384T1Z").error).toBe("length");
    expect(validateGstin("32TTNX87384T1ZW").error).toBe("format");
    const body = "TTNXB7384T1Z";
    expect(validateGstin(`55${body}${gstinChecksum(`55${body}`)}`).error).toBe("state_code");
  });

  it("rejects an empty value", () => {
    expect(validateGstin("").error).toBe("empty");
  });
});

describe("Udyam validator", () => {
  it("accepts every number in the mock registry", () => {
    const rows = loadDataset("mock_udyam_registry");
    expect(rows.filter((r) => !validateUdyam(r.udyam_number).valid)).toEqual([]);
  });

  it("normalises spacing and case", () => {
    const res = validateUdyam("udyam kl 00 3078801");
    expect(res.valid).toBe(true);
    expect(res.normalized).toBe("UDYAM-KL-00-3078801");
  });

  it("rejects bad formats and state codes", () => {
    expect(validateUdyam("UDYAM-KL-00-307880").error).toBe("format");
    expect(validateUdyam("UDYAM-ZZ-00-3078801").error).toBe("state_code");
  });
});

describe("masking", () => {
  it("masks identifiers and street addresses", () => {
    expect(maskGstin("32TTNXB7384T1ZW")).toBe("32TTN*******1ZW");
    expect(maskUdyam("UDYAM-KL-00-3078801")).toBe("UDYAM-KL-00-***8801");
    expect(maskAddress("Shop/Unit 164, Station Road, Kochi, Kerala - 289398")).toBe(
      "***, Kochi, Kerala - 289398",
    );
  });
});
