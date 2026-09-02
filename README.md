# Velobase

[![CI](https://github.com/velobase/velobase/actions/workflows/ci.yml/badge.svg)](https://github.com/velobase/velobase/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Velobase is an open-source usage credit engine for AI and SaaS products. It handles the awkward part of usage billing: reserving an estimate before expensive work starts, then charging the actual cost without losing or double-spending credits.

```text
Grant → Reserve → Settle
                ↘ Release
```

The first source release includes a TypeScript library, PostgreSQL persistence, a local HTTP API, an explainable Ledger Explorer, and a runnable AI video example.

> **Release status:** v0.1 is suitable for evaluation and integration testing. Its accounting invariants are tested, but the API may change before v1.0. The included HTTP server has no authentication and must not be exposed directly to the public internet.

## Try the complete lifecycle

Requirements: Docker, Node.js 20.19 or newer, and pnpm 10.12.1.

```bash
git clone https://github.com/velobase/velobase.git
cd velobase
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), then select **Run the AI video demo**. In one click Velobase will:

1. Grant 100 promotional credits.
2. Reserve all 100 before a simulated video job.
3. Settle the real cost at 67.
4. Return the unused 33 and show every entry in the ledger.

Stop the local stack with `pnpm dev:down`. The PostgreSQL volume is retained so you can inspect the same ledger after restarting.

## Use the TypeScript engine

The library lives at [`packages/billing`](packages/billing) and can be consumed directly inside this workspace:

```ts
import { createBilling, migrate } from "@velobase/billing";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await migrate(pool);

const billing = createBilling({
  pool,
  tenantId: "acme",
  projectId: "video",
});

await billing.grant({
  customerId: "customer-123",
  amount: 100,
  idempotencyKey: "welcome-credit-123",
});

await billing.reserve({
  customerId: "customer-123",
  amount: 100,
  transactionId: "video-job-456",
});

await billing.settle({
  transactionId: "video-job-456",
  actualAmount: 67,
});
```

The resulting available balance is 33. Repeating any operation with the same identity and parameters is safe.

## What the core guarantees

- **Retry-safe writes.** Idempotency fingerprints prevent a retried request from changing meaning.
- **No overspending.** Wallet-scoped locks and PostgreSQL row locks serialize competing reservations.
- **Deterministic allocation.** Credits are consumed first-expiring-first-out, then by creation order.
- **Explicit terminal states.** A reservation can settle or release, but cannot do both.
- **Explainable balances.** Every change produces an append-only ledger entry with source and transaction context.
- **Tenant isolation.** Grants, reservations, balances, and ledger reads are scoped to one tenant and project.
- **Safe migrations.** Applied SQL migrations are checksummed and cannot be silently rewritten.

## Repository map

```text
packages/billing   Framework-agnostic TypeScript contract and PostgreSQL engine
apps/api           Local Fastify adapter and Ledger Explorer
examples/ai-video  Minimal grant → reserve → settle example
docs               API, architecture, state machine, and operations guidance
```

The open-source boundary intentionally contains the complete accounting engine. Authentication, payment collection, invoicing, taxes, pricing catalogs, dashboards, and managed operations are separate concerns and are not hidden requirements for running the core.

## Documentation

- [HTTP API guide](docs/api.md) and [OpenAPI 3.1 contract](openapi.json)
- [Architecture and invariants](docs/architecture.md)
- [Reservation state machine](docs/state-machine.md)
- [Self-hosting and production checklist](docs/self-hosting.md)
- [Roadmap](ROADMAP.md)
- [Contributing](CONTRIBUTING.md), [support](SUPPORT.md), and [security policy](SECURITY.md)

## Development

```bash
pnpm install --frozen-lockfile
pnpm db:up
pnpm test:integration
pnpm db:down
```

`pnpm check` runs formatting, builds the workspace from source, type-checks every package, validates the OpenAPI contract, and executes the test suite.

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
