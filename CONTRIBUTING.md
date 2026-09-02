# Contributing to Velobase

Thank you for helping make usage-based billing safer and easier to adopt.

## Before opening a change

- Search existing issues and pull requests first.
- Open an issue before making a large API, schema, or behavior change.
- Never include customer data, credentials, private URLs, or internal pricing.
- Keep changes focused and explain the user-visible behavior they introduce.

## Local workflow

Requirements:

- Node.js 20.19 or newer
- pnpm 10.12.1
- Docker with Compose

Install dependencies and run the checks:

```bash
pnpm install --frozen-lockfile
pnpm check
```

Tests that exercise PostgreSQL are skipped unless `TEST_DATABASE_URL` is set. Run the complete suite with the local disposable service:

```bash
pnpm db:up
pnpm test:integration
pnpm db:down
```

`pnpm check` validates formatting and OpenAPI, builds from source, type-checks every workspace, runs tests, and installs the packed billing archive in a temporary consumer project.

Changes to the API, migrations, Compose stack, or Dockerfile must also pass the release-equivalent container check:

```bash
pnpm docker:test
```

It builds the production image and verifies one-shot migrations, health, the demo lifecycle, non-root execution, a read-only root filesystem, restart persistence, and migration replay.

## Accounting changes

- State the invariant or failure mode a change protects.
- Test retries and terminal-state behavior for every write operation.
- Include a competing-request test when changing locks or balance mutation.
- Preserve tenant and project scope in queries, constraints, and lock identities.
- Keep ledger history append-only.
- Add a new ordered migration; never edit a migration that may have been applied.

## Commit and pull request expectations

- Use imperative, descriptive commit subjects.
- Add or update tests for behavior changes.
- Document breaking changes and migrations.
- Keep public APIs small and use domain language rather than internal names.
- By contributing, you agree that your contribution is licensed under Apache-2.0.

## Reporting security issues

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md).
