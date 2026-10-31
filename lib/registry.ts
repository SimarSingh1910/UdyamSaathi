import { loadDataset } from "./data";
import { maskAddress } from "./mask";
import { validateGstin, type GstinValidation } from "./validators/gstin";
import { validateUdyam, type UdyamValidation } from "./validators/udyam";

export type GstinStatus = "Active" | "Suspended" | "Cancelled";

export interface GstinRecord {
  gstin: string;
  legalName: string;
  tradeName: string;
  constitution: string;
  address: string;
  state: string;
  registrationDate: string;
  status: GstinStatus;
}

export interface UdyamRecord {
  udyamNumber: string;
  enterpriseName: string;
  enterpriseType: "Micro" | "Small" | "Medium";
  majorActivity: string;
  nicDescription: string;
  state: string;
  city: string;
  registrationDate: string;
}

let gstIndex: Map<string, GstinRecord> | null = null;
let udyamIndex: Map<string, UdyamRecord> | null = null;

function gstinRegistry(): Map<string, GstinRecord> {
  if (!gstIndex) {
    gstIndex = new Map(
      loadDataset("mock_gstin_registry").map((r) => [
        r.gstin,
        {
          gstin: r.gstin,
          legalName: r.legal_name,
          tradeName: r.trade_name,
          constitution: r.constitution,
          address: r.principal_place_of_business,
          state: r.state,
          registrationDate: r.registration_date,
          status: r.status as GstinStatus,
        },
      ]),
    );
  }
  return gstIndex;
}

function udyamRegistry(): Map<string, UdyamRecord> {
  if (!udyamIndex) {
    udyamIndex = new Map(
      loadDataset("mock_udyam_registry").map((r) => [
        r.udyam_number,
        {
          udyamNumber: r.udyam_number,
          enterpriseName: r.enterprise_name,
          enterpriseType: r.enterprise_type as UdyamRecord["enterpriseType"],
          majorActivity: r.major_activity,
          nicDescription: r.nic_description,
          state: r.state,
          city: r.city,
          registrationDate: r.date_of_registration,
        },
      ]),
    );
  }
  return udyamIndex;
}

export type LookupOutcome = "found" | "invalid" | "not_found";

export interface GstinLookupResult {
  outcome: LookupOutcome;
  validation: GstinValidation;
  /** Only the fields the KYC step needs; street address is masked. */
  record?: Omit<GstinRecord, "address"> & { addressMasked: string };
  /** Products that require a GSTIN can be sold only when this is true. */
  usableForKyc: boolean;
  message: string;
}

const STATUS_MESSAGES: Record<GstinStatus, string> = {
  Active: "GST registration is active.",
  Suspended:
    "This GST registration is suspended. You can still buy products that do not need GST, or reactivate it on the GST portal.",
  Cancelled:
    "This GST registration has been cancelled. You can still buy products that do not need GST.",
};

export function lookupGstin(input: string): GstinLookupResult {
  const validation = validateGstin(input);
  if (!validation.valid) {
    return { outcome: "invalid", validation, usableForKyc: false, message: validation.message! };
  }

  const rec = gstinRegistry().get(validation.normalized);
  if (!rec) {
    return {
      outcome: "not_found",
      validation,
      usableForKyc: false,
      message: "We could not find this GSTIN. Check it, or upload your GST certificate instead.",
    };
  }

  const { address, ...rest } = rec;
  return {
    outcome: "found",
    validation,
    record: { ...rest, addressMasked: maskAddress(address) },
    usableForKyc: rec.status === "Active",
    message: STATUS_MESSAGES[rec.status],
  };
}

export interface UdyamLookupResult {
  outcome: LookupOutcome;
  validation: UdyamValidation;
  record?: UdyamRecord;
  message: string;
}

export function lookupUdyam(input: string): UdyamLookupResult {
  const validation = validateUdyam(input);
  if (!validation.valid) {
    return { outcome: "invalid", validation, message: validation.message! };
  }

  const record = udyamRegistry().get(validation.normalized);
  if (!record) {
    return {
      outcome: "not_found",
      validation,
      message: "We could not find this Udyam number. Check it, or upload your Udyam certificate instead.",
    };
  }

  if (validation.state && record.state !== validation.state) {
    return {
      outcome: "invalid",
      validation,
      message: "The state in this Udyam number does not match the registry record.",
    };
  }

  return { outcome: "found", validation, record, message: `${record.enterpriseType} enterprise, registered.` };
}
