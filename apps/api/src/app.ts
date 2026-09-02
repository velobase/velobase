import { randomUUID } from "node:crypto";

import {
  BillingError,
  createBilling,
  type PostgresBilling,
} from "@velobase/billing";
import Fastify, { type FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { ZodError } from "zod";

import { explorerHtml } from "./explorer.js";
import {
  balanceQuerySchema,
  grantSchema,
  ledgerQuerySchema,
  reserveSchema,
  settleSchema,
} from "./schemas.js";

export type CreateAppOptions = {
  pool: Pool;
  tenantId: string;
  projectId: string;
  logger?: boolean;
  clock?: () => Date;
};

function billingStatus(error: BillingError): number {
  if (error.code === "TRANSACTION_NOT_FOUND") return 404;
  if (
    error.code === "IDEMPOTENCY_CONFLICT" ||
    error.code === "TRANSACTION_ALREADY_RELEASED" ||
    error.code === "TRANSACTION_ALREADY_SETTLED" ||
    error.code === "INSUFFICIENT_BALANCE"
  ) {
    return 409;
  }
  if (error.code === "INVARIANT_VIOLATION") return 500;
  return 400;
}

export function createApp(options: CreateAppOptions): {
  app: FastifyInstance;
  billing: PostgresBilling;
} {
  const app = Fastify({ logger: options.logger ?? false });
  const billing = createBilling({
    pool: options.pool,
    tenantId: options.tenantId,
    projectId: options.projectId,
    clock: options.clock,
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof BillingError) {
      return reply.status(billingStatus(error)).send({ error: error.toJSON() });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          name: "ValidationError",
          code: "INVALID_ARGUMENT",
          message: "request validation failed",
          details: { issues: error.issues },
        },
      });
    }
    app.log.error(error);
    return reply.status(500).send({
      error: {
        name: "InternalError",
        code: "INTERNAL_ERROR",
        message: "an unexpected error occurred",
        details: {},
      },
    });
  });

  app.get("/", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(explorerHtml);
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/v1/grants", async (request, reply) => {
    const input = grantSchema.parse(request.body);
    const result = await billing.grant(input);
    return reply.status(result.replayed ? 200 : 201).send(result);
  });

  app.post("/v1/reservations", async (request, reply) => {
    const input = reserveSchema.parse(request.body);
    const result = await billing.reserve(input);
    return reply.status(result.replayed ? 200 : 201).send(result);
  });

  app.post<{ Params: { transactionId: string } }>(
    "/v1/reservations/:transactionId/settle",
    async (request) => {
      const input = settleSchema.parse(request.body);
      return billing.settle({
        transactionId: request.params.transactionId,
        actualAmount: input.actualAmount,
      });
    },
  );

  app.post<{ Params: { transactionId: string } }>(
    "/v1/reservations/:transactionId/release",
    async (request) => {
      return billing.release({ transactionId: request.params.transactionId });
    },
  );

  app.get<{ Params: { customerId: string } }>(
    "/v1/balances/:customerId",
    async (request) => {
      const query = balanceQuerySchema.parse(request.query);
      return billing.getBalance({
        customerId: request.params.customerId,
        wallet: query.wallet,
      });
    },
  );

  app.get("/v1/ledger", async (request) => {
    const query = ledgerQuerySchema.parse(request.query);
    return billing.listLedger(query);
  });

  app.post("/v1/demo/ai-video", async () => {
    const suffix = randomUUID().slice(0, 8);
    const customerId = `video-user-${suffix}`;
    const transactionId = `video-job-${suffix}`;
    const grant = await billing.grant({
      customerId,
      amount: 100,
      idempotencyKey: `welcome-${suffix}`,
      wallet: "video",
      source: "welcome",
      description: "Demo credits",
    });
    const reservation = await billing.reserve({
      customerId,
      amount: 100,
      transactionId,
      wallet: "video",
      description: "Generate an AI launch video",
    });
    const settlement = await billing.settle({
      transactionId,
      actualAmount: 67,
    });
    const balance = await billing.getBalance({ customerId, wallet: "video" });
    const ledger = await billing.listLedger({ customerId, wallet: "video" });
    return { customerId, grant, reservation, settlement, balance, ledger };
  });

  return { app, billing };
}
