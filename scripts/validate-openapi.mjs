import { readFile } from "node:fs/promises";

const document = JSON.parse(
  await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
);

if (document.openapi !== "3.1.0") {
  throw new Error("openapi.json must use OpenAPI 3.1.0");
}

for (const route of [
  "/health",
  "/v1/grants",
  "/v1/reservations",
  "/v1/reservations/{transactionId}/settle",
  "/v1/reservations/{transactionId}/release",
  "/v1/balances/{customerId}",
  "/v1/ledger",
]) {
  if (!document.paths[route])
    throw new Error(`missing OpenAPI route: ${route}`);
}

console.log("openapi.json is valid and contains every public route");
