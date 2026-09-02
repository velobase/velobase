import { describe, expect, it } from "vitest";

import { allocateCredits, BillingError } from "../src/index.js";
import type { GrantSnapshot } from "../src/index.js";

const NOW = new Date("2026-09-02T00:00:00.000Z");

function grant(
  id: string,
  available: number,
  overrides: Partial<GrantSnapshot> = {},
): GrantSnapshot {
  return {
    id,
    source: "purchase",
    available,
    validFrom: null,
    expiresAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("allocateCredits", () => {
  it("allocates from a single grant", () => {
    expect(allocateCredits([grant("a", 100)], 60, NOW)).toEqual([
      { grantId: "a", source: "purchase", amount: 60 },
    ]);
  });

  it("uses grants with the earliest expiry first", () => {
    const later = grant("later", 50, {
      expiresAt: new Date("2026-12-01T00:00:00.000Z"),
    });
    const sooner = grant("sooner", 50, {
      expiresAt: new Date("2026-10-01T00:00:00.000Z"),
    });

    expect(allocateCredits([later, sooner], 70, NOW)).toEqual([
      { grantId: "sooner", source: "purchase", amount: 50 },
      { grantId: "later", source: "purchase", amount: 20 },
    ]);
  });

  it("uses non-expiring grants after expiring grants", () => {
    const permanent = grant("permanent", 100);
    const expiring = grant("expiring", 30, {
      expiresAt: new Date("2026-10-01T00:00:00.000Z"),
    });

    expect(allocateCredits([permanent, expiring], 50, NOW)).toEqual([
      { grantId: "expiring", source: "purchase", amount: 30 },
      { grantId: "permanent", source: "purchase", amount: 20 },
    ]);
  });

  it("falls back to FIFO when expiry dates match", () => {
    const newer = grant("newer", 50, {
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    const older = grant("older", 50, {
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(allocateCredits([newer, older], 70, NOW)).toEqual([
      { grantId: "older", source: "purchase", amount: 50 },
      { grantId: "newer", source: "purchase", amount: 20 },
    ]);
  });

  it("ignores expired, future, zero, and negative grants", () => {
    const usable = grant("usable", 40);
    const ignored = [
      grant("expired", 100, {
        expiresAt: new Date("2026-09-01T00:00:00.000Z"),
      }),
      grant("future", 100, {
        validFrom: new Date("2026-09-03T00:00:00.000Z"),
      }),
      grant("zero", 0),
      grant("negative", -1),
    ];

    expect(allocateCredits([...ignored, usable], 40, NOW)).toEqual([
      { grantId: "usable", source: "purchase", amount: 40 },
    ]);
  });

  it("rejects insufficient balances with structured details", () => {
    expect.assertions(3);
    try {
      allocateCredits([grant("a", 10)], 11, NOW);
    } catch (error) {
      expect(error).toBeInstanceOf(BillingError);
      expect((error as BillingError).code).toBe("INSUFFICIENT_BALANCE");
      expect((error as BillingError).details).toEqual({
        requested: 11,
        available: 10,
      });
    }
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid amount %s",
    (amount) => {
      expect(() => allocateCredits([grant("a", 100)], amount, NOW)).toThrow(
        expect.objectContaining({ code: "INVALID_ARGUMENT" }),
      );
    },
  );

  it("uses the grant id as a deterministic final tie-breaker", () => {
    expect(allocateCredits([grant("b", 10), grant("a", 10)], 15, NOW)).toEqual([
      { grantId: "a", source: "purchase", amount: 10 },
      { grantId: "b", source: "purchase", amount: 5 },
    ]);
  });
});
