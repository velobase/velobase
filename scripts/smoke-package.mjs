import { execFileSync } from "node:child_process";
import { access, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageDirectory = join(repository, "packages", "billing");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "velobase-package-"));
const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

try {
  execFileSync(
    packageManager,
    ["pack", "--pack-destination", temporaryDirectory],
    { cwd: packageDirectory, stdio: "pipe" },
  );
  const archive = (await readdir(temporaryDirectory)).find((name) =>
    name.endsWith(".tgz"),
  );
  if (!archive) throw new Error("pnpm pack did not produce an archive");

  await writeFile(
    join(temporaryDirectory, "package.json"),
    `${JSON.stringify(
      {
        name: "velobase-package-smoke-test",
        private: true,
        type: "module",
        dependencies: {
          "@velobase/billing": `file:${join(temporaryDirectory, archive)}`,
          pg: "^8.23.0",
        },
      },
      null,
      2,
    )}\n`,
  );
  execFileSync(packageManager, ["install", "--ignore-scripts"], {
    cwd: temporaryDirectory,
    stdio: "pipe",
  });
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      'import { BillingError, createBilling, migrate } from "@velobase/billing"; if (![BillingError, createBilling, migrate].every(Boolean)) process.exit(1)',
    ],
    { cwd: temporaryDirectory, stdio: "pipe" },
  );
  await access(
    join(
      temporaryDirectory,
      "node_modules",
      "@velobase",
      "billing",
      "migrations",
      "0001_initial.sql",
    ),
  );
  await access(
    join(temporaryDirectory, "node_modules", "@velobase", "billing", "NOTICE"),
  );
  console.log(`package archive installs and imports successfully: ${archive}`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
