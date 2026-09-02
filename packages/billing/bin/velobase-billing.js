#!/usr/bin/env node

try {
  await import("../dist/cli.js");
} catch (error) {
  if (error && error.code === "ERR_MODULE_NOT_FOUND") {
    console.error(
      "Velobase has not been built. Run `pnpm --filter @velobase/billing build` first.",
    );
    process.exitCode = 1;
  } else {
    throw error;
  }
}
