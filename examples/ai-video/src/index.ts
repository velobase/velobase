import { randomUUID } from "node:crypto";

import { createBilling, migrate } from "@velobase/billing";
import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://velobase:velobase@127.0.0.1:54329/velobase",
});
const suffix = randomUUID().slice(0, 8);
const customerId = `video-user-${suffix}`;
const transactionId = `video-job-${suffix}`;

try {
  await migrate(pool);
  const billing = createBilling({
    pool,
    tenantId: "demo",
    projectId: "ai-video",
  });

  const grant = await billing.grant({
    customerId,
    amount: 100,
    idempotencyKey: `welcome-${suffix}`,
    wallet: "video",
    source: "welcome",
  });
  console.log("1. Granted", grant.amount, "credits");

  const reservation = await billing.reserve({
    customerId,
    amount: 100,
    transactionId,
    wallet: "video",
    description: "Generate an AI launch video",
  });
  console.log("2. Reserved", reservation.reservedAmount, "credits");

  const settlement = await billing.settle({
    transactionId,
    actualAmount: 67,
  });
  console.log(
    "3. Settled",
    settlement.settledAmount,
    "and released",
    settlement.releasedAmount,
  );

  const balance = await billing.getBalance({ customerId, wallet: "video" });
  const ledger = await billing.listLedger({ customerId, wallet: "video" });
  console.log("4. Available balance", balance.available);
  console.table(
    ledger.entries
      .slice()
      .reverse()
      .map((entry) => ({
        operation: entry.operation,
        amount: entry.amount,
        transactionId: entry.transactionId,
      })),
  );
} finally {
  await pool.end();
}
