export type BillingErrorCode =
  | "INVALID_ARGUMENT"
  | "INSUFFICIENT_BALANCE"
  | "IDEMPOTENCY_CONFLICT"
  | "TRANSACTION_NOT_FOUND"
  | "TRANSACTION_ALREADY_SETTLED"
  | "TRANSACTION_ALREADY_RELEASED"
  | "INVARIANT_VIOLATION";

export type BillingErrorDetails = Readonly<Record<string, unknown>>;

export class BillingError extends Error {
  readonly code: BillingErrorCode;
  readonly details: BillingErrorDetails;

  constructor(
    code: BillingErrorCode,
    message: string,
    details: BillingErrorDetails = {},
  ) {
    super(message);
    this.name = "BillingError";
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
