import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { BillingError, createBilling, migrate } from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
const FIXED_NOW = new Date("2026-09-02T12:00:00.000Z");

integration("PostgresBilling", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const billing = createBilling({
    pool,
    tenantId: "test-tenant",
    projectId: "test-project",
    clock: () => FIXED_NOW,
  });

  beforeAll(async () => {
    await migrate(pool);
  });

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        billing_ledger_entries,
        billing_allocations,
        billing_reservations,
        billing_grants
      CASCADE
    `);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("runs the AI reservation lifecycle and explains every balance change", async () => {
    await billing.grant({
      customerId: "video-user",
      amount: 100,
      idempotencyKey: "welcome-credits",
      source: "welcome",
    });

    const reservation = await billing.reserve({
      customerId: "video-user",
      amount: 100,
      transactionId: "video-job-456",
      description: "Generate launch video",
    });
    expect(reservation).toMatchObject({
      status: "RESERVED",
      reservedAmount: 100,
      settledAmount: 0,
      releasedAmount: 0,
      replayed: false,
    });
    await expect(
      billing.getBalance({ customerId: "video-user" }),
    ).resolves.toMatchObject({
      total: 100,
      used: 0,
      reserved: 100,
      available: 0,
    });

    const settlement = await billing.settle({
      transactionId: "video-job-456",
      actualAmount: 67,
    });
    expect(settlement).toMatchObject({
      status: "SETTLED",
      reservedAmount: 100,
      settledAmount: 67,
      releasedAmount: 33,
      replayed: false,
    });
    await expect(
      billing.getBalance({ customerId: "video-user" }),
    ).resolves.toMatchObject({
      total: 100,
      used: 67,
      reserved: 0,
      available: 33,
    });

    const ledger = await billing.listLedger({ customerId: "video-user" });
    expect(ledger.entries).toHaveLength(4);
    expect(ledger.entries.map((entry) => entry.operation).sort()).toEqual([
      "GRANT",
      "RELEASE",
      "RESERVE",
      "SETTLE",
    ]);
  });

  it("replays grants and rejects reuse with different parameters", async () => {
    const input = {
      customerId: "customer-1",
      amount: 100,
      idempotencyKey: "grant-1",
    };
    const first = await billing.grant(input);
    const replay = await billing.grant(input);
    expect(replay).toMatchObject({ grantId: first.grantId, replayed: true });

    await expect(
      billing.grant({ ...input, amount: 101 }),
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
    const ledger = await billing.listLedger({ customerId: "customer-1" });
    expect(ledger.entries).toHaveLength(1);
  });

  it("paginates ledger entries without gaps when timestamps are equal", async () => {
    for (const idempotencyKey of ["grant-1", "grant-2", "grant-3"]) {
      await billing.grant({
        customerId: "customer-1",
        amount: 10,
        idempotencyKey,
      });
    }

    const firstPage = await billing.listLedger({
      customerId: "customer-1",
      limit: 2,
    });
    expect(firstPage.entries).toHaveLength(2);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await billing.listLedger({
      customerId: "customer-1",
      limit: 2,
      cursor: firstPage.nextCursor!,
    });
    expect(secondPage.entries).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
    expect(
      new Set([...firstPage.entries, ...secondPage.entries].map(({ id }) => id))
        .size,
    ).toBe(3);
  });

  it("makes reservation and settlement retries safe after terminal state", async () => {
    await billing.grant({
      customerId: "customer-1",
      amount: 100,
      idempotencyKey: "grant-1",
    });
    const input = {
      customerId: "customer-1",
      amount: 70,
      transactionId: "job-1",
    };
    const original = await billing.reserve(input);
    expect((await billing.reserve(input)).replayed).toBe(true);

    await billing.settle({ transactionId: "job-1", actualAmount: 50 });
    const settledReplay = await billing.settle({
      transactionId: "job-1",
      actualAmount: 50,
    });
    expect(settledReplay).toMatchObject({
      reservationId: original.reservationId,
      status: "SETTLED",
      replayed: true,
    });
    const reserveReplay = await billing.reserve(input);
    expect(reserveReplay).toMatchObject({ status: "SETTLED", replayed: true });

    await expect(
      billing.settle({ transactionId: "job-1", actualAmount: 51 }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(
      billing.reserve({ ...input, amount: 71 }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("releases a reservation exactly once", async () => {
    await billing.grant({
      customerId: "customer-1",
      amount: 100,
      idempotencyKey: "grant-1",
    });
    await billing.reserve({
      customerId: "customer-1",
      amount: 80,
      transactionId: "job-1",
    });

    const released = await billing.release({ transactionId: "job-1" });
    expect(released).toMatchObject({
      status: "RELEASED",
      releasedAmount: 80,
      replayed: false,
    });
    expect((await billing.release({ transactionId: "job-1" })).replayed).toBe(
      true,
    );
    await expect(
      billing.settle({ transactionId: "job-1", actualAmount: 10 }),
    ).rejects.toMatchObject({ code: "TRANSACTION_ALREADY_RELEASED" });
    await expect(
      billing.getBalance({ customerId: "customer-1" }),
    ).resolves.toMatchObject({ used: 0, reserved: 0, available: 100 });
  });

  it("serializes competing reservations for the same wallet", async () => {
    await billing.grant({
      customerId: "customer-1",
      amount: 100,
      idempotencyKey: "grant-1",
    });

    const attempts = await Promise.allSettled([
      billing.reserve({
        customerId: "customer-1",
        amount: 80,
        transactionId: "job-a",
      }),
      billing.reserve({
        customerId: "customer-1",
        amount: 80,
        transactionId: "job-b",
      }),
    ]);
    const successes = attempts.filter(
      (attempt) => attempt.status === "fulfilled",
    );
    const failures = attempts.filter(
      (attempt) => attempt.status === "rejected",
    );
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect((failures[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "INSUFFICIENT_BALANCE",
    });
    await expect(
      billing.getBalance({ customerId: "customer-1" }),
    ).resolves.toMatchObject({ used: 0, reserved: 80, available: 20 });
  });

  it("uses expiring grants first", async () => {
    const permanent = await billing.grant({
      customerId: "customer-1",
      amount: 100,
      idempotencyKey: "permanent",
      source: "purchase",
    });
    const expiring = await billing.grant({
      customerId: "customer-1",
      amount: 50,
      idempotencyKey: "expiring",
      source: "promotion",
      expiresAt: new Date("2026-10-01T00:00:00.000Z"),
    });

    const reservation = await billing.reserve({
      customerId: "customer-1",
      amount: 60,
      transactionId: "job-1",
    });
    expect(reservation.allocations).toEqual([
      { grantId: expiring.grantId, source: "promotion", amount: 50 },
      { grantId: permanent.grantId, source: "purchase", amount: 10 },
    ]);
    await expect(
      billing.reserve({
        customerId: "customer-1",
        amount: 60,
        transactionId: "job-1",
      }),
    ).resolves.toMatchObject({
      allocations: reservation.allocations,
      replayed: true,
    });
  });

  it("isolates tenants and projects", async () => {
    const other = createBilling({
      pool,
      tenantId: "another-tenant",
      projectId: "test-project",
      clock: () => FIXED_NOW,
    });
    await billing.grant({
      customerId: "same-customer",
      amount: 100,
      idempotencyKey: "same-grant",
    });
    await other.grant({
      customerId: "same-customer",
      amount: 30,
      idempotencyKey: "same-grant",
    });

    await expect(
      billing.getBalance({ customerId: "same-customer" }),
    ).resolves.toMatchObject({ available: 100 });
    await expect(
      other.getBalance({ customerId: "same-customer" }),
    ).resolves.toMatchObject({ available: 30 });
  });

  it("automatically releases or fully settles due reservations", async () => {
    let currentTime = FIXED_NOW;
    const scheduled = createBilling({
      pool,
      tenantId: "test-tenant",
      projectId: "test-project",
      clock: () => currentTime,
    });
    await scheduled.grant({
      customerId: "customer-1",
      amount: 100,
      idempotencyKey: "grant-1",
    });
    await scheduled.reserve({
      customerId: "customer-1",
      amount: 30,
      transactionId: "release-me",
      autoReleaseAfterSeconds: 60,
    });
    await scheduled.reserve({
      customerId: "customer-1",
      amount: 40,
      transactionId: "settle-me",
      autoSettleAfterSeconds: 60,
    });

    expect(await scheduled.settleDue()).toMatchObject({ processed: 0 });
    currentTime = new Date(FIXED_NOW.getTime() + 61_000);
    expect(await scheduled.settleDue()).toEqual({
      processed: 2,
      settled: 1,
      released: 1,
      replayed: 0,
      failures: [],
    });
    await expect(
      scheduled.getBalance({ customerId: "customer-1" }),
    ).resolves.toMatchObject({
      total: 100,
      used: 40,
      reserved: 0,
      available: 60,
    });
  });

  it("reports missing transactions with a stable error", async () => {
    await expect(billing.release({ transactionId: "missing" })).rejects.toEqual(
      expect.objectContaining<BillingError>({
        code: "TRANSACTION_NOT_FOUND",
      }),
    );
  });

  it("applies migrations idempotently", async () => {
    await expect(migrate(pool)).resolves.toEqual([
      { version: "0001_initial.sql", applied: false },
      { version: "0002_allocation_order.sql", applied: false },
    ]);
  });
});
