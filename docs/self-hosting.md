# Containers and self-hosting

Velobase publishes a multi-platform image for `linux/amd64` and `linux/arm64`. The released Compose stack is optimized for a safe local first run: it binds the unauthenticated HTTP adapter to loopback, runs migrations as a one-shot service, waits for PostgreSQL health, and persists the ledger in a named volume.

## Docker-only quick start

Download the Compose file attached to the release and start it:

```bash
curl --fail --location \
  https://github.com/velobase/velobase/releases/download/v0.1.1/compose.yaml \
  --output compose.yaml
docker compose up --detach --wait
```

Open [http://localhost:3000](http://localhost:3000). Inspect status and logs with:

```bash
docker compose ps
docker compose logs --follow api
```

`docker compose down` stops the stack without deleting its ledger. `docker compose down --volumes` permanently removes the bundled database volume and all balances in it.

## Image contract

The image is published at `ghcr.io/velobase/velobase` with these tags:

| Tag            | Intended use                                               |
| -------------- | ---------------------------------------------------------- |
| `0.1.1`        | Immutable application release; recommended for deployments |
| `0.1`          | Latest compatible patch in the `0.1` line                  |
| `latest`       | Latest stable release; convenient for evaluation only      |
| `sha-<commit>` | Exact source revision for diagnosis and reproducibility    |

The default command is `server`. The same image exposes an explicit, idempotent `migrate` command. For an external PostgreSQL database:

```bash
export DATABASE_URL=postgresql://user:password@database.example.com:5432/velobase

docker run --rm \
  --env DATABASE_URL \
  ghcr.io/velobase/velobase:0.1.1 migrate

docker run --detach \
  --name velobase \
  --read-only \
  --tmpfs /tmp \
  --env DATABASE_URL \
  --env VELOBASE_TENANT_ID=acme \
  --env VELOBASE_PROJECT_ID=video \
  --publish 127.0.0.1:3000:3000 \
  ghcr.io/velobase/velobase:0.1.1
```

Run migrations once per deployment before starting new API replicas. The migration engine uses PostgreSQL advisory locks and checksums, so replay is safe and a previously applied migration cannot be silently rewritten.

## Compose configuration

Copy the released `velobase.env.example` to `.env` when you need to change defaults:

| Variable                | Default                           | Purpose                                        |
| ----------------------- | --------------------------------- | ---------------------------------------------- |
| `VELOBASE_IMAGE`        | `ghcr.io/velobase/velobase:0.1.1` | Exact image reference used by Compose          |
| `VELOBASE_BIND_ADDRESS` | `127.0.0.1`                       | Host interface that publishes the HTTP adapter |
| `VELOBASE_PORT`         | `3000`                            | Published host port                            |
| `VELOBASE_TENANT_ID`    | `demo`                            | Trusted tenant scope for every API operation   |
| `VELOBASE_PROJECT_ID`   | `ai-video`                        | Trusted project scope for every API operation  |

The bundled PostgreSQL service is not published to the host. The development override exposes it only on loopback at `VELOBASE_POSTGRES_PORT`, which defaults to `54329`.

## Verify the image

Every stable image is built from the release commit with an attached SBOM and maximum-mode build provenance, then signed keylessly by the release workflow. With Cosign installed, verify both the GitHub Actions issuer and the exact workflow identity:

```bash
cosign verify \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity https://github.com/velobase/velobase/.github/workflows/release.yml@refs/tags/v0.1.1 \
  ghcr.io/velobase/velobase:0.1.1
```

Release assets include `SHA256SUMS` for the Compose file, environment template, and npm-compatible package archive.

## Security boundary

The included Fastify service is a local adapter and has no authentication. Do not bind it to a public interface or expose it directly to the internet. For real balances:

- call the TypeScript engine from a trusted backend, or put authenticated authorization and TLS in front of the HTTP adapter;
- derive `tenantId` and `projectId` from trusted deployment configuration or verified identity, never from request JSON;
- use a managed PostgreSQL credential from a secret manager and restrict direct database access;
- apply request, rate, and payload-size limits at the gateway;
- never put API keys, payment data, personal data, or generated content into ledger metadata;
- keep the container filesystem read-only, drop Linux capabilities, and run the image as its built-in unprivileged user.

The Compose defaults demonstrate local behavior, not a hardened production database topology. Production operators own high availability, TLS, credentials, connection limits, backups, recovery, monitoring, and authenticated ingress.

## Backups and upgrades

Back up PostgreSQL and prove that restoration works before accepting real balances. For the bundled evaluation database, create a logical backup with:

```bash
docker compose exec --no-TTY postgres \
  pg_dump --username velobase --dbname velobase --format=custom \
  > velobase.backup
```

To upgrade:

1. Read [CHANGELOG.md](../CHANGELOG.md) and back up the database.
2. Download the new versioned `compose.yaml` release asset.
3. Run `docker compose pull`.
4. Run `docker compose run --rm migrate` and confirm success.
5. Run `docker compose up --detach --wait` and verify `/health` plus a known balance.

Database migrations are forward-only. Never edit an applied migration; add a new one. Test application rollback against a restored database backup rather than assuming a newer schema can be downgraded. Pre-1.0 releases may change the TypeScript and HTTP contracts, so pin exact versions until v1.0.

## Reservation recovery and monitoring

A worker can fail after reserving credits but before choosing a terminal state. Set `autoReleaseAfterSeconds` for work that should be refunded after a deadline, or `autoSettleAfterSeconds` when the full reservation is the safe fallback. Run `billing.settleDue()` from a scheduled worker and monitor its returned failures. Do not set both automatic actions on one reservation.

At minimum, monitor database availability and lock waits, `INSUFFICIENT_BALANCE` and invariant errors, stale `RESERVED` transactions, automatic-action failures, migration checksum failures, and backup restoration age. The append-only ledger remains the source of truth for balance changes.

## Build the image from source

Contributors use the development override, which builds the same runtime image from the working tree and exposes PostgreSQL on loopback for integration tests:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build --wait
```

Run `pnpm docker:test` to verify migration ordering, health, the complete demo lifecycle, non-root execution, persistence across API restart, and migration replay.
