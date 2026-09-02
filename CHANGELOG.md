# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

## [0.1.1] - 2026-09-02

### Added

- An official multi-platform container release for `linux/amd64` and `linux/arm64` on GitHub Container Registry.
- Release image vulnerability scanning, an attached SBOM and provenance, and keyless Cosign signing.
- A Docker-only quick start, versioned Compose release asset, and source-build override for contributors.
- A repeatable container smoke test covering migrations, health, the complete demo lifecycle, non-root execution, restart persistence, and migration replay.

### Changed

- The runtime image now uses the maintained Node.js 24 LTS line, a minimal multi-stage build, and an unprivileged user with a read-only filesystem in Compose.
- Database migrations run as an explicit one-shot Compose service before the API starts.
- The bundled API binds to `127.0.0.1` by default and PostgreSQL is no longer published to the host outside the development override.

## [0.1.0] - 2026-09-02

### Added

- Open-source project governance and Apache-2.0 licensing.
- Public billing domain types, structured errors, and deterministic FEFO allocation.
- Continuous integration for formatting, type checking, tests, and builds.
- PostgreSQL grants, reservations, settlements, releases, balances, and append-only ledger storage.
- Checksum-protected migrations and automatic reservation settlement.
- Integration tests for retries, terminal states, tenant isolation, FEFO allocation, and concurrent reservations.
- A local Fastify API, Ledger Explorer, Docker Compose environment, and runnable AI video example.
- Lossless opaque-cursor pagination for ledger entries with identical timestamps.
- OpenAPI 3.1 documentation, architecture and self-hosting guides, issue forms, and release artifact automation.

[Unreleased]: https://github.com/velobase/velobase/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/velobase/velobase/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/velobase/velobase/releases/tag/v0.1.0
