# Roadmap

Velobase is building a small, trustworthy foundation for usage credits rather than a broad billing suite.

## Now: v0.1 foundation

- Reliable grant, reserve, settle, and release lifecycle.
- PostgreSQL transactions, concurrency safety, migrations, and append-only ledger.
- TypeScript contract, local HTTP adapter, OpenAPI definition, and Ledger Explorer.
- Runnable AI workload example and complete self-hosting documentation.
- Signed multi-platform container images, a Docker-only quick start, and automated image vulnerability scanning.

## Next

- Publish `@velobase/billing` to npm with provenance.
- Add PostgreSQL compatibility and performance benchmarks.
- Add an operator command for scheduled terminal actions.
- Add instrumentation hooks for metrics and tracing without choosing a vendor.
- Document adapters for common job queues and AI SDK workflows.
- Provide a reference authenticated gateway for teams that want to deploy the HTTP adapter beyond loopback.

## Later, after evidence

- Additional storage implementations behind the same contract.
- More granular policy hooks for allocation and overage behavior.
- Reconciliation and repair tooling that preserves append-only history.

Features move into the roadmap when a concrete user workflow demonstrates that they belong in the core. Open a feature request with the problem, failure mode, and smallest useful contract.
