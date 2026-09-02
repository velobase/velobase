import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { Pool } from "pg";

export type AppliedMigration = {
  version: string;
  applied: boolean;
};

export async function migrate(pool: Pool): Promise<AppliedMigration[]> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS velobase_billing_migrations (
      version VARCHAR(255) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDirectory = fileURLToPath(
    new URL("../migrations", import.meta.url),
  );
  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
  const results: AppliedMigration[] = [];

  for (const filename of filenames) {
    const sql = await readFile(`${migrationsDirectory}/${filename}`, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`velobase:migration:${filename}`],
      );
      const existing = await client.query<{ checksum: string }>(
        "SELECT checksum FROM velobase_billing_migrations WHERE version = $1",
        [filename],
      );

      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(
            `migration ${filename} changed after it was applied; create a new migration instead`,
          );
        }
        await client.query("COMMIT");
        results.push({ version: filename, applied: false });
        continue;
      }

      await client.query(sql);
      await client.query(
        "INSERT INTO velobase_billing_migrations (version, checksum) VALUES ($1, $2)",
        [filename, checksum],
      );
      await client.query("COMMIT");
      results.push({ version: filename, applied: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return results;
}
