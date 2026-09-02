import { BillingError } from "./errors.js";

const MAX_IDENTIFIER_LENGTH = 255;
const MAX_AUTOMATIC_ACTION_SECONDS = 30 * 24 * 60 * 60;

export function requireIdentifier(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new BillingError("INVALID_ARGUMENT", `${field} must not be empty`, {
      field,
    });
  }
  if (normalized.length > MAX_IDENTIFIER_LENGTH) {
    throw new BillingError(
      "INVALID_ARGUMENT",
      `${field} must not exceed ${MAX_IDENTIFIER_LENGTH} characters`,
      { field, maximum: MAX_IDENTIFIER_LENGTH },
    );
  }
  return normalized;
}

export function requirePositiveAmount(value: number, field = "amount"): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new BillingError(
      "INVALID_ARGUMENT",
      `${field} must be a positive safe integer`,
      { field, value },
    );
  }
  return value;
}

export function requireNonNegativeAmount(
  value: number,
  field = "amount",
): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BillingError(
      "INVALID_ARGUMENT",
      `${field} must be a non-negative safe integer`,
      { field, value },
    );
  }
  return value;
}

export function validateGrantDates(validFrom?: Date, expiresAt?: Date): void {
  if (validFrom && Number.isNaN(validFrom.getTime())) {
    throw new BillingError("INVALID_ARGUMENT", "validFrom must be valid", {
      field: "validFrom",
    });
  }
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new BillingError("INVALID_ARGUMENT", "expiresAt must be valid", {
      field: "expiresAt",
    });
  }
  if (validFrom && expiresAt && expiresAt <= validFrom) {
    throw new BillingError(
      "INVALID_ARGUMENT",
      "expiresAt must be later than validFrom",
      { field: "expiresAt" },
    );
  }
}

export function validateAutomaticAction(input: {
  autoReleaseAfterSeconds?: number;
  autoSettleAfterSeconds?: number;
}): void {
  const values = [
    ["autoReleaseAfterSeconds", input.autoReleaseAfterSeconds],
    ["autoSettleAfterSeconds", input.autoSettleAfterSeconds],
  ] as const;

  if (
    input.autoReleaseAfterSeconds !== undefined &&
    input.autoSettleAfterSeconds !== undefined
  ) {
    throw new BillingError(
      "INVALID_ARGUMENT",
      "autoReleaseAfterSeconds and autoSettleAfterSeconds are mutually exclusive",
      { fields: ["autoReleaseAfterSeconds", "autoSettleAfterSeconds"] },
    );
  }

  for (const [field, value] of values) {
    if (value === undefined) continue;
    if (
      !Number.isSafeInteger(value) ||
      value <= 0 ||
      value > MAX_AUTOMATIC_ACTION_SECONDS
    ) {
      throw new BillingError(
        "INVALID_ARGUMENT",
        `${field} must be between 1 and ${MAX_AUTOMATIC_ACTION_SECONDS} seconds`,
        { field, value, maximum: MAX_AUTOMATIC_ACTION_SECONDS },
      );
    }
  }
}
