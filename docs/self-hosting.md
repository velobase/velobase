# Self-hosting and production checklist

The Docker Compose stack is optimized for a safe local first run. Before using Velobase with real balances, own the operational boundary around the library.

## Required controls

- Call the TypeScript engine from a trusted backend, or place authentication and authorization in front of your HTTP adapter.
- Derive `tenantId` and `projectId` from trusted server configuration or verified identity, never directly from request JSON.
- Use TLS for every network hop and restrict direct PostgreSQL access.
- Store database credentials in a secret manager and rotate the demonstration password.
- Back up PostgreSQL and test point-in-time recovery.
- Run migrations once per deployment before serving traffic.
- Configure connection pool limits for your database capacity.
- Apply request limits, rate limits, and payload size limits at the gateway.
- Never put API keys, payment data, personal data, or generated content into ledger metadata.

## Reservation recovery

A worker can fail after reserving credits but before choosing a terminal state. Set `autoReleaseAfterSeconds` for work that should be refunded after a deadline, or `autoSettleAfterSeconds` when the full reservation is the safe fallback. Run `billing.settleDue()` from a scheduled worker and monitor its returned failures.

Choose the deadline from the longest valid job runtime plus retry tolerance. Do not set both automatic actions on one reservation.

## Monitoring

At minimum, monitor:

- database availability, latency, connection saturation, and lock wait time;
- counts of `INSUFFICIENT_BALANCE`, `IDEMPOTENCY_CONFLICT`, and invariant errors;
- reservations remaining in `RESERVED` past their expected completion time;
- failures returned by `settleDue`;
- migration failures and checksum mismatches;
- backup age and restoration test results.

The ledger is the audit source for balance changes. Export it to your observability system if operators need cross-service correlation, while preserving the database as the source of truth.

## Upgrades

Read [CHANGELOG.md](../CHANGELOG.md), back up the database, apply migrations in a staging environment, run integration tests against the same PostgreSQL major version, and then deploy the application code. Never edit an applied migration; add a new one.

Pre-1.0 releases may change the TypeScript and HTTP contracts. Pin exact versions or commits until the project reaches v1.0.
