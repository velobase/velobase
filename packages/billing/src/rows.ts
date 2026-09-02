import { BillingError } from "./errors.js";
import type { JsonValue, ReservationStatus } from "./types.js";

export type GrantRow = {
  id: string;
  customer_id: string;
  wallet: string;
  source: string;
  request_fingerprint: string;
  total_amount: string;
  used_amount: string;
  reserved_amount: string;
  valid_from: Date | null;
  expires_at: Date | null;
  description: string | null;
  metadata: Record<string, JsonValue> | null;
  created_at: Date;
};

export type ReservationRow = {
  id: string;
  customer_id: string;
  wallet: string;
  transaction_id: string;
  request_fingerprint: string;
  status: ReservationStatus;
  reserved_amount: string;
  settled_amount: string;
  released_amount: string;
  automatic_action: "SETTLE" | "RELEASE" | null;
  automatic_action_after_seconds: number | null;
  automatic_action_at: Date | null;
  description: string | null;
  metadata: Record<string, JsonValue> | null;
  created_at: Date;
};

export type AllocationRow = {
  id: string;
  grant_id: string;
  source: string;
  reserved_amount: string;
  settled_amount: string;
  released_amount: string;
  status: ReservationStatus;
  allocation_order: number;
  created_at: Date;
};

export function toSafeAmount(value: string | number, field: string): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(amount)) {
    throw new BillingError(
      "INVARIANT_VIOLATION",
      `${field} exceeds the JavaScript safe integer range`,
      { field, value },
    );
  }
  return amount;
}
