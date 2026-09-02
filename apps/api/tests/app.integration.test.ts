import { migrate } from "@velobase/billing";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

describe("health readiness", () => {
  it("reports failure when PostgreSQL is unavailable", async () => {
    const pool = {
      query: async () => {
        throw new Error("database unavailable");
      },
    } as unknown as Pool;
    const { app } = createApp({
      pool,
      tenantId: "health-test",
      projectId: "health-test",
    });

    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      error: { code: "INTERNAL_ERROR" },
    });
    await app.close();
  });
});

integration("Velobase API", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const { app } = createApp({
    pool,
    tenantId: "api-test-tenant",
    projectId: "api-test-project",
    clock: () => new Date("2026-09-02T12:00:00.000Z"),
  });

  beforeAll(async () => {
    await migrate(pool);
    await app.ready();
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
    await app.close();
    await pool.end();
  });

  it("serves the health check and Ledger Explorer", async () => {
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });

    const explorer = await app.inject({ method: "GET", url: "/" });
    expect(explorer.statusCode).toBe(200);
    expect(explorer.headers["content-type"]).toContain("text/html");
    expect(explorer.body).toContain("Know where every credit went.");

    const openapi = await app.inject({ method: "GET", url: "/openapi.json" });
    expect(openapi.statusCode).toBe(200);
    expect(openapi.json()).toMatchObject({
      openapi: "3.1.0",
      info: { title: "Velobase Local API" },
    });
  });

  it("exposes the complete reservation lifecycle", async () => {
    const grant = await app.inject({
      method: "POST",
      url: "/v1/grants",
      payload: {
        customerId: "customer-1",
        amount: 100,
        idempotencyKey: "grant-1",
        wallet: "video",
      },
    });
    expect(grant.statusCode).toBe(201);

    const reserve = await app.inject({
      method: "POST",
      url: "/v1/reservations",
      payload: {
        customerId: "customer-1",
        amount: 100,
        transactionId: "video-1",
        wallet: "video",
      },
    });
    expect(reserve.statusCode).toBe(201);
    expect(reserve.json()).toMatchObject({ status: "RESERVED" });

    const settle = await app.inject({
      method: "POST",
      url: "/v1/reservations/video-1/settle",
      payload: { actualAmount: 67 },
    });
    expect(settle.statusCode).toBe(200);
    expect(settle.json()).toMatchObject({
      status: "SETTLED",
      settledAmount: 67,
      releasedAmount: 33,
    });

    const balance = await app.inject({
      method: "GET",
      url: "/v1/balances/customer-1?wallet=video",
    });
    expect(balance.json()).toMatchObject({
      total: 100,
      used: 67,
      reserved: 0,
      available: 33,
    });

    const ledger = await app.inject({
      method: "GET",
      url: "/v1/ledger?customerId=customer-1&wallet=video",
    });
    expect(ledger.json().entries).toHaveLength(4);
  });

  it("runs the one-click AI video demo", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/demo/ai-video",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      balance: { total: 100, used: 67, reserved: 0, available: 33 },
      settlement: { settledAmount: 67, releasedAmount: 33 },
    });
  });

  it("returns stable machine-readable errors", async () => {
    const invalid = await app.inject({
      method: "POST",
      url: "/v1/grants",
      payload: { customerId: "customer-1", amount: -1 },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({
      error: { code: "INVALID_ARGUMENT" },
    });

    const missing = await app.inject({
      method: "POST",
      url: "/v1/reservations/missing/release",
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({
      error: { code: "TRANSACTION_NOT_FOUND" },
    });
  });
});
