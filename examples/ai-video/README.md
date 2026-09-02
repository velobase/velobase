# AI video reservation example

This example reserves 100 credits before an AI video job starts, settles the actual cost of 67 credits, and releases the unused 33 credits.

From the repository root:

```bash
pnpm db:up
pnpm demo
```

Every run uses new idempotency identities and prints the complete lifecycle and resulting ledger.
