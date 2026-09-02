import { migrate } from "@velobase/billing";
import { Pool } from "pg";

import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://velobase:velobase@127.0.0.1:54329/velobase",
});

await migrate(pool);
const { app, billing } = createApp({
  pool,
  tenantId: process.env.VELOBASE_TENANT_ID ?? "demo",
  projectId: process.env.VELOBASE_PROJECT_ID ?? "ai-video",
  logger: true,
});

const settlementTimer = setInterval(() => {
  void billing.settleDue().then((result) => {
    if (result.processed > 0 || result.failures.length > 0) {
      app.log.info(result, "processed automatic reservation actions");
    }
  });
}, 5_000);
settlementTimer.unref();

const close = async () => {
  clearInterval(settlementTimer);
  await app.close();
  await pool.end();
};
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());

await app.listen({ port, host });
