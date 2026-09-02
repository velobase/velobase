# Security Policy

## Supported versions

Velobase is currently pre-release. Security fixes are applied to the latest release and the default branch.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository. Include the affected version, reproduction steps, impact, and any suggested mitigation.

Do not include secrets, production customer data, or exploit details in public issues. We will acknowledge a complete report within five business days and coordinate disclosure after a fix is available.

## Deployment boundary

The HTTP app in `apps/api` is an unauthenticated local reference adapter. Exposing it to an untrusted network without authentication and authorization is unsupported and unsafe. See the [self-hosting checklist](docs/self-hosting.md) before integrating real balances.

## Scope

Reports about broken tenant isolation, double spending, idempotency bypass, ledger mutation, unsafe migration behavior, or dependency vulnerabilities are in scope. Reports that require the documented local demo server to be intentionally exposed without a security gateway are generally configuration issues unless they demonstrate a separate defect.
