# Velobase

Velobase is an open-source usage credit engine for AI and SaaS products.

Its first release focuses on a reliable reservation workflow for workloads whose final cost is not known in advance:

```text
Grant → Reserve → Settle or Release
```

The billing engine is being extracted from Velobase's production system into a small, independently runnable project. The public API, PostgreSQL storage, local Ledger Explorer, and AI video example will land as independently reviewable commits before the first public release.

## Project status

Pre-release. The repository is being prepared in the open-source release branch and is not yet ready for production use.

## Principles

- Simple enough to try in ten minutes.
- Safe to retry without charging twice.
- Observable enough to explain every balance change.
- Useful when AI workloads reserve an estimate and settle the actual cost.
- Complete for self-hosting; hosted products add operations, scale, and support.
- Built through small, reviewable changes with public release notes.

## License

Apache License 2.0. See [LICENSE](LICENSE).
