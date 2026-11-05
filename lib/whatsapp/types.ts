import type { ChatTurn } from "../advisor-chat";
import type { PartialAnswers, QuestionKey } from "../advisor-parse";
import type { BusinessProfile } from "../eligibility";
import type { Text } from "../i18n";
import type { LangCode } from "../languages";

/** Where the owner is in the WhatsApp journey (mirrors the screens of /start). */
export type WaStep =
  | "language"
  | "advisor"
  | "bundle"
  | "edit"
  | "consent"
  | "kyc"
  | "name"
  | "phone_choice"
  | "phone_enter"
  | "phone_method"
  | "phone_code"
  | "phone_missed"
  | "done";

export interface WaCartLine {
  productId: string;
  quantity: number;
  on: boolean;
  why?: Text;
}

export interface WaSession {
  /** Keyed hash of the WhatsApp id. */
  key: string;
  /** WhatsApp id (country code + number). Tokenised when saved to disk. */
  waId: string;
  profileName?: string;
  lang: LangCode;
  step: WaStep;
  history: ChatTurn[];
  answers: PartialAnswers;
  /** The advisor question last asked. */
  pending: QuestionKey | null;
  profile?: BusinessProfile;
  cart?: WaCartLine[];
  /** KYC outcome only. The document text itself is never saved. */
  kyc?: {
    canOrder: boolean;
    gstinUsable: boolean;
    tradeName?: string;
    legalName?: string;
    gstinMasked?: string;
    signatory?: string;
  };
  contactName?: string;
  /** A different number to call, waiting for verification. Tokenised when saved. */
  pendingPhone?: string;
  verificationId?: string;
  orderIds: string[];
  /** Recent WhatsApp message ids: Meta retries webhooks, so each is handled once. */
  seen: string[];
  createdAt: number;
  updatedAt: number;
}
