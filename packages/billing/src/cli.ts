#!/usr/bin/env node

import { Pool } from "pg";

import { migrate } from "./migrate.js";

async function main() {
  const command = process.argv[2];
  if (command !== "migrate") {
    console.error("Usage: velobase-billing migrate");
    process.exitCode = 1;
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required");
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString });
  try {
    const results = await migrate(pool);
    for (const result of results) {
      console.log(
        `${result.applied ? "applied" : "already applied"}: ${result.version}`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
