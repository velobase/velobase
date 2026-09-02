import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import { allocateCredits } from "./allocation.js";
import { BillingError } from "./errors.js";
import { fingerprint } from "./fingerprint.js";
import type { AllocationRow, GrantRow, ReservationRow } from "./rows.js";
import { toSafeAmount } from "./rows.js";
import type {
  BalanceResult,
  Billing,
  BillingConfig,
  GetBalanceInput,
  GrantInput,
  GrantResult,
  JsonValue,
  LedgerEntry,
  LedgerOperation,
  LedgerResult,
  ListLedgerInput,
  ReleaseInput,
  ReservationResult,
  ReserveInput,
  SettleInput,
  SettleDueInput,
  SettleDueResult,
} from "./types.js";
import {
  requireIdentifier,
  requireNonNegativeAmount,
  requirePositiveAmount,
  validateAutomaticAction,
  validateGrantDates,
} from "./validation.js";

const DEFAULT_WALLET = "default";
const DEFAULT_SOURCE = "default";

export type CreateBillingOptions = BillingConfig & {
  pool: Pool;
  clock?: () => Date;
  idGenerator?: () => string;
};

type LedgerRow = {
  id: string;
  customer_id: string;
  wallet: string;
  source: string;
  transaction_id: string;
  operation: LedgerOperation;
  amount: string;
  description: string | null;
  metadata: Record<string, JsonValue> | null;
  created_at: Date;
};

type DueReservationRow = {
  transaction_id: string;
  reserved_amount: string;
  automatic_action: "SETTLE" | "RELEASE";
};

function automaticAction(input: ReserveInput): {
  action: "SETTLE" | "RELEASE" | null;
  afterSeconds: number | null;
} {
  if (input.autoReleaseAfterSeconds !== undefined) {
    return { action: "RELEASE", afterSeconds: input.autoReleaseAfterSeconds };
  }
  if (input.autoSettleAfterSeconds !== undefined) {
    return { action: "SETTLE", afterSeconds: input.autoSettleAfterSeconds };
  }
  return { action: null, afterSeconds: null };
}

async function inTransaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export class PostgresBilling implements Billing {
  readonly tenantId: string;
  readonly projectId: string;
  readonly defaultWallet: string;

  private readonly pool: Pool;
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;

  constructor(options: CreateBillingOptions) {
    this.pool = options.pool;
    this.tenantId = requireIdentifier(options.tenantId, "tenantId");
    this.projectId = requireIdentifier(options.projectId, "projectId");
    this.defaultWallet = requireIdentifier(
      options.defaultWallet ?? DEFAULT_WALLET,
      "defaultWallet",
    );
    this.clock = options.clock ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
  }

  async grant(input: GrantInput): Promise<GrantResult> {
    const customerId = requireIdentifier(input.customerId, "customerId");
    const amount = requirePositiveAmount(input.amount);
    const idempotencyKey = requireIdentifier(
      input.idempotencyKey,
      "idempotencyKey",
    );
    const wallet = requireIdentifier(
      input.wallet ?? this.defaultWallet,
      "wallet",
    );
    const source = requireIdentifier(input.source ?? DEFAULT_SOURCE, "source");
    validateGrantDates(input.validFrom, input.expiresAt);
    const now = this.now();
    const requestFingerprint = fingerprint({
      customerId,
      amount,
      wallet,
      source,
      validFrom: input.validFrom ?? null,
      expiresAt: input.expiresAt ?? null,
      description: input.description ?? null,
      metadata: input.metadata ?? null,
    });

    return inTransaction(this.pool, async (client) => {
      await this.lock(client, `grant:${idempotencyKey}`);
      const existing = await client.query<GrantRow>(
        `SELECT * FROM billing_grants
         WHERE tenant_id = $1 AND project_id = $2 AND idempotency_key = $3`,
        [this.tenantId, this.projectId, idempotencyKey],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].request_fingerprint !== requestFingerprint) {
          throw this.idempotencyConflict("grant", idempotencyKey);
        }
        return this.toGrantResult(existing.rows[0], true);
      }

      const grantId = this.idGenerator();
      const inserted = await client.query<GrantRow>(
        `INSERT INTO billing_grants (
           id, tenant_id, project_id, customer_id, wallet, source,
           idempotency_key, request_fingerprint, total_amount, used_amount,
           reserved_amount, valid_from, expires_at, description, metadata,
           created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0, $10, $11, $12, $13, $14, $14
         ) RETURNING *`,
        [
          grantId,
          this.tenantId,
          this.projectId,
          customerId,
          wallet,
          source,
          idempotencyKey,
          requestFingerprint,
          amount,
          input.validFrom ?? null,
          input.expiresAt ?? null,
          input.description ?? null,
          input.metadata ?? null,
          now,
        ],
      );

      await this.insertLedger(client, {
        customerId,
        wallet,
        source,
        grantId,
        reservationId: null,
        transactionId: idempotencyKey,
        operation: "GRANT",
        amount,
        description: input.description ?? null,
        metadata: input.metadata ?? null,
        createdAt: now,
      });

      return this.toGrantResult(inserted.rows[0]!, false);
    });
  }

  async reserve(input: ReserveInput): Promise<ReservationResult> {
    const customerId = requireIdentifier(input.customerId, "customerId");
    const amount = requirePositiveAmount(input.amount);
    const transactionId = requireIdentifier(
      input.transactionId,
      "transactionId",
    );
    const wallet = requireIdentifier(
      input.wallet ?? this.defaultWallet,
      "wallet",
    );
    validateAutomaticAction(input);
    const automatic = automaticAction(input);
    const now = this.now();
    const actionAt = automatic.afterSeconds
      ? new Date(now.getTime() + automatic.afterSeconds * 1000)
      : null;
    const requestFingerprint = fingerprint({
      customerId,
      amount,
      wallet,
      automaticAction: automatic.action,
      automaticActionAfterSeconds: automatic.afterSeconds,
      description: input.description ?? null,
      metadata: input.metadata ?? null,
    });

    return inTransaction(this.pool, async (client) => {
      await this.lock(client, `transaction:${transactionId}`);
      const existing = await this.findReservation(client, transactionId, false);
      if (existing) {
        if (existing.request_fingerprint !== requestFingerprint) {
          throw this.idempotencyConflict("reservation", transactionId);
        }
        return this.toReservationResult(client, existing, true);
      }

      await this.lock(client, `wallet:${customerId}:${wallet}`);
      const grantRows = await client.query<GrantRow>(
        `SELECT * FROM billing_grants
         WHERE tenant_id = $1
           AND project_id = $2
           AND customer_id = $3
           AND wallet = $4
           AND (valid_from IS NULL OR valid_from <= $5)
           AND (expires_at IS NULL OR expires_at > $5)
           AND total_amount - used_amount - reserved_amount > 0
         ORDER BY expires_at ASC NULLS LAST, created_at ASC, id ASC
         FOR UPDATE`,
        [this.tenantId, this.projectId, customerId, wallet, now],
      );
      const allocations = allocateCredits(
        grantRows.rows.map((row) => ({
          id: row.id,
          source: row.source,
          available:
            toSafeAmount(row.total_amount, "totalAmount") -
            toSafeAmount(row.used_amount, "usedAmount") -
            toSafeAmount(row.reserved_amount, "reservedAmount"),
          validFrom: row.valid_from,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
        })),
        amount,
        now,
      );

      const reservationId = this.idGenerator();
      const inserted = await client.query<ReservationRow>(
        `INSERT INTO billing_reservations (
           id, tenant_id, project_id, customer_id, wallet, transaction_id,
           request_fingerprint, status, reserved_amount, settled_amount,
           released_amount, automatic_action, automatic_action_after_seconds,
           automatic_action_at, description, metadata, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, 'RESERVED', $8, 0, 0,
           $9, $10, $11, $12, $13, $14, $14
         ) RETURNING *`,
        [
          reservationId,
          this.tenantId,
          this.projectId,
          customerId,
          wallet,
          transactionId,
          requestFingerprint,
          amount,
          automatic.action,
          automatic.afterSeconds,
          actionAt,
          input.description ?? null,
          input.metadata ?? null,
          now,
        ],
      );

      for (const [allocationOrder, allocation] of allocations.entries()) {
        await client.query(
          `UPDATE billing_grants
           SET reserved_amount = reserved_amount + $1, updated_at = $2
           WHERE id = $3`,
          [allocation.amount, now, allocation.grantId],
        );
        await client.query(
          `INSERT INTO billing_allocations (
             id, reservation_id, grant_id, reserved_amount, settled_amount,
             released_amount, status, allocation_order, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, 0, 0, 'RESERVED', $5, $6, $6)`,
          [
            this.idGenerator(),
            reservationId,
            allocation.grantId,
            allocation.amount,
            allocationOrder,
            now,
          ],
        );
        await this.insertLedger(client, {
          customerId,
          wallet,
          source: allocation.source,
          grantId: allocation.grantId,
          reservationId,
          transactionId,
          operation: "RESERVE",
          amount: allocation.amount,
          description: input.description ?? null,
          metadata: input.metadata ?? null,
          createdAt: now,
        });
      }

      return this.toReservationResult(client, inserted.rows[0]!, false);
    });
  }

  async settle(input: SettleInput): Promise<ReservationResult> {
    const transactionId = requireIdentifier(
      input.transactionId,
      "transactionId",
    );
    const actualAmount = requireNonNegativeAmount(
      input.actualAmount,
      "actualAmount",
    );
    const now = this.now();

    return inTransaction(this.pool, async (client) => {
      await this.lock(client, `transaction:${transactionId}`);
      const reservation = await this.findReservation(
        client,
        transactionId,
        true,
      );
      if (!reservation) throw this.transactionNotFound(transactionId);

      const reservedAmount = toSafeAmount(
        reservation.reserved_amount,
        "reservedAmount",
      );
      if (reservation.status === "SETTLED") {
        if (
          toSafeAmount(reservation.settled_amount, "settledAmount") !==
          actualAmount
        ) {
          throw this.idempotencyConflict("settlement", transactionId);
        }
        return this.toReservationResult(client, reservation, true);
      }
      if (reservation.status === "RELEASED") {
        throw new BillingError(
          "TRANSACTION_ALREADY_RELEASED",
          "a released reservation cannot be settled",
          { transactionId },
        );
      }
      if (actualAmount > reservedAmount) {
        throw new BillingError(
          "INVALID_ARGUMENT",
          "actualAmount cannot exceed the reserved amount",
          { transactionId, actualAmount, reservedAmount },
        );
      }

      const allocations = await this.lockAllocations(client, reservation.id);
      let remaining = actualAmount;
      for (const allocation of allocations) {
        const allocationAmount = toSafeAmount(
          allocation.reserved_amount,
          "allocation.reservedAmount",
        );
        const settled = Math.min(allocationAmount, remaining);
        const released = allocationAmount - settled;

        await client.query(
          `UPDATE billing_grants
           SET reserved_amount = reserved_amount - $1,
               used_amount = used_amount + $2,
               updated_at = $3
           WHERE id = $4`,
          [allocationAmount, settled, now, allocation.grant_id],
        );
        await client.query(
          `UPDATE billing_allocations
           SET settled_amount = $1,
               released_amount = $2,
               status = $3,
               updated_at = $4
           WHERE id = $5`,
          [
            settled,
            released,
            settled > 0 ? "SETTLED" : "RELEASED",
            now,
            allocation.id,
          ],
        );
        if (settled > 0) {
          await this.insertLedger(client, {
            customerId: reservation.customer_id,
            wallet: reservation.wallet,
            source: allocation.source,
            grantId: allocation.grant_id,
            reservationId: reservation.id,
            transactionId,
            operation: "SETTLE",
            amount: settled,
            description: reservation.description,
            metadata: reservation.metadata,
            createdAt: now,
          });
        }
        if (released > 0) {
          await this.insertLedger(client, {
            customerId: reservation.customer_id,
            wallet: reservation.wallet,
            source: allocation.source,
            grantId: allocation.grant_id,
            reservationId: reservation.id,
            transactionId,
            operation: "RELEASE",
            amount: released,
            description: reservation.description,
            metadata: reservation.metadata,
            createdAt: now,
          });
        }
        remaining -= settled;
      }

      if (remaining !== 0) {
        throw new BillingError(
          "INVARIANT_VIOLATION",
          "settlement allocations do not match the reservation",
          { transactionId, remaining },
        );
      }

      const updated = await client.query<ReservationRow>(
        `UPDATE billing_reservations
         SET status = 'SETTLED', settled_amount = $1, released_amount = $2,
             updated_at = $3
         WHERE id = $4
         RETURNING *`,
        [actualAmount, reservedAmount - actualAmount, now, reservation.id],
      );
      return this.toReservationResult(client, updated.rows[0]!, false);
    });
  }

  async release(input: ReleaseInput): Promise<ReservationResult> {
    const transactionId = requireIdentifier(
      input.transactionId,
      "transactionId",
    );
    const now = this.now();

    return inTransaction(this.pool, async (client) => {
      await this.lock(client, `transaction:${transactionId}`);
      const reservation = await this.findReservation(
        client,
        transactionId,
        true,
      );
      if (!reservation) throw this.transactionNotFound(transactionId);
      if (reservation.status === "RELEASED") {
        return this.toReservationResult(client, reservation, true);
      }
      if (reservation.status === "SETTLED") {
        throw new BillingError(
          "TRANSACTION_ALREADY_SETTLED",
          "a settled reservation cannot be released",
          { transactionId },
        );
      }

      const allocations = await this.lockAllocations(client, reservation.id);
      for (const allocation of allocations) {
        const amount = toSafeAmount(
          allocation.reserved_amount,
          "allocation.reservedAmount",
        );
        await client.query(
          `UPDATE billing_grants
           SET reserved_amount = reserved_amount - $1, updated_at = $2
           WHERE id = $3`,
          [amount, now, allocation.grant_id],
        );
        await client.query(
          `UPDATE billing_allocations
           SET released_amount = reserved_amount,
               status = 'RELEASED',
               updated_at = $1
           WHERE id = $2`,
          [now, allocation.id],
        );
        await this.insertLedger(client, {
          customerId: reservation.customer_id,
          wallet: reservation.wallet,
          source: allocation.source,
          grantId: allocation.grant_id,
          reservationId: reservation.id,
          transactionId,
          operation: "RELEASE",
          amount,
          description: reservation.description,
          metadata: reservation.metadata,
          createdAt: now,
        });
      }

      const reservedAmount = toSafeAmount(
        reservation.reserved_amount,
        "reservedAmount",
      );
      const updated = await client.query<ReservationRow>(
        `UPDATE billing_reservations
         SET status = 'RELEASED', released_amount = $1, updated_at = $2
         WHERE id = $3
         RETURNING *`,
        [reservedAmount, now, reservation.id],
      );
      return this.toReservationResult(client, updated.rows[0]!, false);
    });
  }

  async getBalance(input: GetBalanceInput): Promise<BalanceResult> {
    const customerId = requireIdentifier(input.customerId, "customerId");
    const wallet = requireIdentifier(
      input.wallet ?? this.defaultWallet,
      "wallet",
    );
    const now = this.now();
    const result = await this.pool.query<GrantRow>(
      `SELECT * FROM billing_grants
       WHERE tenant_id = $1
         AND project_id = $2
         AND customer_id = $3
         AND wallet = $4
         AND (valid_from IS NULL OR valid_from <= $5)
         AND (expires_at IS NULL OR expires_at > $5)
       ORDER BY expires_at ASC NULLS LAST, created_at ASC, id ASC`,
      [this.tenantId, this.projectId, customerId, wallet, now],
    );

    const grants = result.rows.map((row) => {
      const total = toSafeAmount(row.total_amount, "totalAmount");
      const used = toSafeAmount(row.used_amount, "usedAmount");
      const reserved = toSafeAmount(row.reserved_amount, "reservedAmount");
      return {
        grantId: row.id,
        source: row.source,
        total,
        used,
        reserved,
        available: total - used - reserved,
        validFrom: row.valid_from,
        expiresAt: row.expires_at,
      };
    });
    const total = grants.reduce((sum, grant) => sum + grant.total, 0);
    const used = grants.reduce((sum, grant) => sum + grant.used, 0);
    const reserved = grants.reduce((sum, grant) => sum + grant.reserved, 0);

    return {
      customerId,
      wallet,
      total,
      used,
      reserved,
      available: total - used - reserved,
      grants,
    };
  }

  async listLedger(input: ListLedgerInput = {}): Promise<LedgerResult> {
    const limit = input.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new BillingError(
        "INVALID_ARGUMENT",
        "limit must be an integer between 1 and 100",
        { field: "limit", value: limit },
      );
    }
    if (input.before && Number.isNaN(input.before.getTime())) {
      throw new BillingError("INVALID_ARGUMENT", "before must be valid", {
        field: "before",
      });
    }

    const clauses = ["tenant_id = $1", "project_id = $2"];
    const values: unknown[] = [this.tenantId, this.projectId];
    const addClause = (sql: string, value: unknown) => {
      values.push(value);
      clauses.push(sql.replace("?", `$${values.length}`));
    };
    if (input.customerId !== undefined) {
      addClause(
        "customer_id = ?",
        requireIdentifier(input.customerId, "customerId"),
      );
    }
    if (input.wallet !== undefined) {
      addClause("wallet = ?", requireIdentifier(input.wallet, "wallet"));
    }
    if (input.transactionId !== undefined) {
      addClause(
        "transaction_id = ?",
        requireIdentifier(input.transactionId, "transactionId"),
      );
    }
    if (input.before !== undefined) {
      addClause("created_at < ?", input.before);
    }
    values.push(limit);

    const result = await this.pool.query<LedgerRow>(
      `SELECT id, customer_id, wallet, source, transaction_id, operation,
              amount, description, metadata, created_at
       FROM billing_ledger_entries
       WHERE ${clauses.join(" AND ")}
       ORDER BY created_at DESC, id DESC
       LIMIT $${values.length}`,
      values,
    );
    const entries: LedgerEntry[] = result.rows.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      wallet: row.wallet,
      source: row.source,
      transactionId: row.transaction_id,
      operation: row.operation,
      amount: toSafeAmount(row.amount, "ledger.amount"),
      description: row.description,
      metadata: row.metadata,
      createdAt: row.created_at,
    }));
    return {
      entries,
      nextBefore: entries.length === limit ? entries.at(-1)!.createdAt : null,
    };
  }

  async settleDue(input: SettleDueInput = {}): Promise<SettleDueResult> {
    const limit = input.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new BillingError(
        "INVALID_ARGUMENT",
        "limit must be an integer between 1 and 100",
        { field: "limit", value: limit },
      );
    }

    const now = this.now();
    const due = await this.pool.query<DueReservationRow>(
      `SELECT transaction_id, reserved_amount, automatic_action
       FROM billing_reservations
       WHERE tenant_id = $1
         AND project_id = $2
         AND status = 'RESERVED'
         AND automatic_action_at <= $3
       ORDER BY automatic_action_at ASC, id ASC
       LIMIT $4`,
      [this.tenantId, this.projectId, now, limit],
    );
    const result: SettleDueResult = {
      processed: 0,
      settled: 0,
      released: 0,
      replayed: 0,
      failures: [],
    };

    for (const reservation of due.rows) {
      try {
        const outcome =
          reservation.automatic_action === "SETTLE"
            ? await this.settle({
                transactionId: reservation.transaction_id,
                actualAmount: toSafeAmount(
                  reservation.reserved_amount,
                  "reservedAmount",
                ),
              })
            : await this.release({
                transactionId: reservation.transaction_id,
              });
        result.processed += 1;
        if (outcome.replayed) result.replayed += 1;
        if (outcome.status === "SETTLED") result.settled += 1;
        if (outcome.status === "RELEASED") result.released += 1;
      } catch (error) {
        result.failures.push({
          transactionId: reservation.transaction_id,
          code: error instanceof BillingError ? error.code : "UNKNOWN",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  private now(): Date {
    const now = this.clock();
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
      throw new BillingError(
        "INVARIANT_VIOLATION",
        "the configured clock returned an invalid date",
      );
    }
    return now;
  }

  private async lock(client: PoolClient, resource: string): Promise<void> {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`${this.tenantId}:${this.projectId}:${resource}`],
    );
  }

  private async findReservation(
    client: PoolClient,
    transactionId: string,
    forUpdate: boolean,
  ): Promise<ReservationRow | null> {
    const result = await client.query<ReservationRow>(
      `SELECT * FROM billing_reservations
       WHERE tenant_id = $1 AND project_id = $2 AND transaction_id = $3
       ${forUpdate ? "FOR UPDATE" : ""}`,
      [this.tenantId, this.projectId, transactionId],
    );
    return result.rows[0] ?? null;
  }

  private async lockAllocations(
    client: PoolClient,
    reservationId: string,
  ): Promise<AllocationRow[]> {
    const result = await client.query<AllocationRow>(
      `SELECT allocation.*, grant_row.source
       FROM billing_allocations allocation
       JOIN billing_grants grant_row ON grant_row.id = allocation.grant_id
       WHERE allocation.reservation_id = $1
       ORDER BY allocation.allocation_order ASC
       FOR UPDATE OF allocation, grant_row`,
      [reservationId],
    );
    return result.rows;
  }

  private async toReservationResult(
    client: PoolClient,
    reservation: ReservationRow,
    replayed: boolean,
  ): Promise<ReservationResult> {
    const result = await client.query<AllocationRow>(
      `SELECT allocation.*, grant_row.source
       FROM billing_allocations allocation
       JOIN billing_grants grant_row ON grant_row.id = allocation.grant_id
       WHERE allocation.reservation_id = $1
       ORDER BY allocation.allocation_order ASC`,
      [reservation.id],
    );

    return {
      reservationId: reservation.id,
      transactionId: reservation.transaction_id,
      customerId: reservation.customer_id,
      wallet: reservation.wallet,
      status: reservation.status,
      reservedAmount: toSafeAmount(
        reservation.reserved_amount,
        "reservedAmount",
      ),
      settledAmount: toSafeAmount(reservation.settled_amount, "settledAmount"),
      releasedAmount: toSafeAmount(
        reservation.released_amount,
        "releasedAmount",
      ),
      allocations: result.rows.map((row) => ({
        grantId: row.grant_id,
        source: row.source,
        amount: toSafeAmount(row.reserved_amount, "allocation.amount"),
      })),
      automaticAction: reservation.automatic_action,
      automaticActionAt: reservation.automatic_action_at,
      replayed,
    };
  }

  private toGrantResult(row: GrantRow, replayed: boolean): GrantResult {
    const total = toSafeAmount(row.total_amount, "totalAmount");
    const used = toSafeAmount(row.used_amount, "usedAmount");
    const reserved = toSafeAmount(row.reserved_amount, "reservedAmount");
    return {
      grantId: row.id,
      customerId: row.customer_id,
      wallet: row.wallet,
      source: row.source,
      amount: total,
      available: total - used - reserved,
      validFrom: row.valid_from,
      expiresAt: row.expires_at,
      replayed,
    };
  }

  private async insertLedger(
    client: PoolClient,
    entry: {
      customerId: string;
      wallet: string;
      source: string;
      grantId: string;
      reservationId: string | null;
      transactionId: string;
      operation: LedgerOperation;
      amount: number;
      description: string | null;
      metadata: Readonly<Record<string, JsonValue>> | null;
      createdAt: Date;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO billing_ledger_entries (
         id, tenant_id, project_id, customer_id, wallet, source, grant_id,
         reservation_id, transaction_id, operation, amount, description,
         metadata, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        this.idGenerator(),
        this.tenantId,
        this.projectId,
        entry.customerId,
        entry.wallet,
        entry.source,
        entry.grantId,
        entry.reservationId,
        entry.transactionId,
        entry.operation,
        entry.amount,
        entry.description,
        entry.metadata,
        entry.createdAt,
      ],
    );
  }

  private idempotencyConflict(operation: string, key: string): BillingError {
    return new BillingError(
      "IDEMPOTENCY_CONFLICT",
      `the ${operation} key was already used with different parameters`,
      { operation, key },
    );
  }

  private transactionNotFound(transactionId: string): BillingError {
    return new BillingError(
      "TRANSACTION_NOT_FOUND",
      "the reservation transaction does not exist",
      { transactionId },
    );
  }
}

export function createBilling(options: CreateBillingOptions): PostgresBilling {
  return new PostgresBilling(options);
}
