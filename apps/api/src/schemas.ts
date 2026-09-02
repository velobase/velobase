import { z } from "zod";

const identifier = z.string().trim().min(1).max(255);
const amount = z.number().int().safe().positive();
const metadata = z.record(z.string(), z.json()).optional();

export const grantSchema = z
  .object({
    customerId: identifier,
    amount,
    idempotencyKey: identifier,
    wallet: identifier.optional(),
    source: identifier.optional(),
    validFrom: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
    description: z.string().max(2_000).optional(),
    metadata,
  })
  .strict();

export const reserveSchema = z
  .object({
    customerId: identifier,
    amount,
    transactionId: identifier,
    wallet: identifier.optional(),
    autoReleaseAfterSeconds: z.number().int().positive().optional(),
    autoSettleAfterSeconds: z.number().int().positive().optional(),
    description: z.string().max(2_000).optional(),
    metadata,
  })
  .strict();

export const settleSchema = z
  .object({
    actualAmount: z.number().int().safe().nonnegative(),
  })
  .strict();

export const ledgerQuerySchema = z.object({
  customerId: identifier.optional(),
  wallet: identifier.optional(),
  transactionId: identifier.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).max(512).optional(),
});

export const balanceQuerySchema = z.object({
  wallet: identifier.optional(),
});
