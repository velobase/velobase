import { BillingError } from "./errors.js";
import { requirePositiveAmount } from "./validation.js";

export type GrantSnapshot = {
  id: string;
  source: string;
  available: number;
  validFrom: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
};

export type DebitAllocation = {
  grantId: string;
  source: string;
  amount: number;
};

function compareGrants(left: GrantSnapshot, right: GrantSnapshot): number {
  if (left.expiresAt && !right.expiresAt) return -1;
  if (!left.expiresAt && right.expiresAt) return 1;
  if (left.expiresAt && right.expiresAt) {
    const expiryDifference =
      left.expiresAt.getTime() - right.expiresAt.getTime();
    if (expiryDifference !== 0) return expiryDifference;
  }

  const creationDifference =
    left.createdAt.getTime() - right.createdAt.getTime();
  if (creationDifference !== 0) return creationDifference;
  return left.id.localeCompare(right.id);
}

export function allocateCredits(
  grants: readonly GrantSnapshot[],
  amount: number,
  now = new Date(),
): DebitAllocation[] {
  requirePositiveAmount(amount);

  const spendable = grants
    .filter(
      (grant) =>
        Number.isSafeInteger(grant.available) &&
        grant.available > 0 &&
        (!grant.validFrom || grant.validFrom <= now) &&
        (!grant.expiresAt || grant.expiresAt > now),
    )
    .sort(compareGrants);

  const totalAvailable = spendable.reduce(
    (sum, grant) => sum + grant.available,
    0,
  );
  if (!Number.isSafeInteger(totalAvailable)) {
    throw new BillingError(
      "INVARIANT_VIOLATION",
      "available balance exceeds the safe integer range",
      { totalAvailable },
    );
  }
  if (totalAvailable < amount) {
    throw new BillingError(
      "INSUFFICIENT_BALANCE",
      "the wallet does not have enough available credits",
      { requested: amount, available: totalAvailable },
    );
  }

  const allocations: DebitAllocation[] = [];
  let remaining = amount;

  for (const grant of spendable) {
    if (remaining === 0) break;
    const allocated = Math.min(grant.available, remaining);
    allocations.push({
      grantId: grant.id,
      source: grant.source,
      amount: allocated,
    });
    remaining -= allocated;
  }

  if (remaining !== 0) {
    throw new BillingError(
      "INVARIANT_VIOLATION",
      "allocation did not satisfy the requested amount",
      { requested: amount, remaining },
    );
  }

  return allocations;
}
