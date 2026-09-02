# Contributing to Velobase

Thank you for helping make usage-based billing safer and easier to adopt.

## Before opening a change

- Search existing issues and pull requests first.
- Open an issue before making a large API, schema, or behavior change.
- Never include customer data, credentials, private URLs, or internal pricing.
- Keep changes focused and explain the user-visible behavior they introduce.

## Local workflow

Requirements:

- Node.js 20 or newer
- pnpm 10.12.1
- Docker with Compose

Install dependencies and run the checks:

```bash
pnpm install
pnpm check
```

Package-specific instructions will be documented with each package as it lands.

## Commit and pull request expectations

- Use imperative, descriptive commit subjects.
- Add or update tests for behavior changes.
- Document breaking changes and migrations.
- Keep public APIs small and use domain language rather than internal names.
- By contributing, you agree that your contribution is licensed under Apache-2.0.

## Reporting security issues

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md).
