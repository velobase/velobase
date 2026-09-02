# @velobase/billing

The framework-agnostic usage credit engine that powers Velobase.

The package is included in the v0.1 source release; npm publishing is on the roadmap. Its public contract uses seven operations:

```text
grant → reserve → settle
                ↘ release
```

- `grant` creates an expiring or non-expiring credit bucket.
- `reserve` safely holds an estimated amount for a job.
- `settle` charges the actual amount and returns the unused reservation.
- `release` returns a reservation without charging it.
- `getBalance` and `listLedger` explain the resulting balance.
- `settleDue` applies configured automatic terminal actions from a trusted worker.

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

Ledger pagination uses an opaque cursor:

```ts
const first = await billing.listLedger({
  customerId: "customer-123",
  limit: 50,
});
const second = first.nextCursor
  ? await billing.listLedger({
      customerId: "customer-123",
      limit: 50,
      cursor: first.nextCursor,
    })
  : null;
```

See the [architecture and invariants](../../docs/architecture.md) and [self-hosting checklist](../../docs/self-hosting.md) before using real balances.
