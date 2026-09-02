# Velobase

Velobase is an open-source usage credit engine for AI and SaaS products.

Its first release focuses on a reliable reservation workflow for workloads whose final cost is not known in advance:

```text
Grant → Reserve → Settle or Release
```

The billing engine is being extracted from Velobase's production system into a small, independently runnable project. It now includes a TypeScript API, PostgreSQL storage, a local Ledger Explorer, and an AI video example.

## Try it locally

Requirements: Docker, Node.js 20.19 or newer, and pnpm 10.12.1.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and run the AI video lifecycle: grant 100 credits, reserve 100, settle 67, and release 33. The web interface and API are intentionally unauthenticated for local evaluation; do not expose this demo server to the public internet.

To run the same lifecycle from TypeScript instead:

```bash
pnpm db:up
pnpm demo
pnpm db:down
```

## Project status

Pre-release. The core accounting rules and persistence layer are tested, but the public API may still change before v1.0.0.

## Principles

- Simple enough to try in ten minutes.
- Safe to retry without charging twice.
- Observable enough to explain every balance change.
- Useful when AI workloads reserve an estimate and settle the actual cost.
- Complete for self-hosting; hosted products add operations, scale, and support.
- Built through small, reviewable changes with public release notes.

## License

Apache License 2.0. See [LICENSE](LICENSE).
