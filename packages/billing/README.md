# @velobase/billing

The framework-agnostic usage credit engine that powers Velobase.

The package is under active extraction and is not published yet. Its public contract uses five operations:

```text
grant → reserve → settle
                ↘ release
```

- `grant` creates an expiring or non-expiring credit bucket.
- `reserve` safely holds an estimated amount for a job.
- `settle` charges the actual amount and returns the unused reservation.
- `release` returns a reservation without charging it.
- `getBalance` and `listLedger` explain the resulting balance.

## PostgreSQL usage

```ts
import { Pool } from "pg";
import { createBilling, migrate } from "@velobase/billing";

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

The resulting balance is 33. Repeating any request with the same identity and parameters is safe. See the [reservation state machine](../../docs/state-machine.md) for terminal-state and conflict behavior.
