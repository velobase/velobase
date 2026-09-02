import { describe, expect, it } from "vitest";

import {
  BillingError,
  requireIdentifier,
  requireNonNegativeAmount,
  requirePositiveAmount,
  validateAutomaticAction,
  validateGrantDates,
} from "../src/index.js";

describe("public input validation", () => {
  it("normalizes identifiers", () => {
    expect(requireIdentifier("  video-123  ", "transactionId")).toBe(
      "video-123",
    );
  });

  it("rejects empty identifiers with a stable error code", () => {
    expect(() => requireIdentifier("  ", "transactionId")).toThrow(
      expect.objectContaining<BillingError>({ code: "INVALID_ARGUMENT" }),
    );
  });

  it("accepts safe integer amounts", () => {
    expect(requirePositiveAmount(1)).toBe(1);
    expect(requireNonNegativeAmount(0)).toBe(0);
  });

  it("requires an expiry after the validity start", () => {
    expect(() =>
      validateGrantDates(
        new Date("2026-09-02T00:00:00.000Z"),
        new Date("2026-09-01T00:00:00.000Z"),
      ),
    ).toThrow(expect.objectContaining({ code: "INVALID_ARGUMENT" }));
  });

  it("allows one automatic reservation action", () => {
    expect(() =>
      validateAutomaticAction({ autoReleaseAfterSeconds: 60 }),
    ).not.toThrow();
    expect(() =>
      validateAutomaticAction({ autoSettleAfterSeconds: 60 }),
    ).not.toThrow();
  });

  it("rejects competing automatic actions", () => {
    expect(() =>
      validateAutomaticAction({
        autoReleaseAfterSeconds: 60,
        autoSettleAfterSeconds: 60,
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_ARGUMENT" }));
  });
});
