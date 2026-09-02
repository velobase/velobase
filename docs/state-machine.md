# Reservation state machine

Velobase treats the client-provided `transactionId` as the stable identity of one reservation lifecycle within a tenant and project.

```text
                 settle(actualAmount)
              ┌────────────────────────▶ SETTLED
              │
RESERVED ──────┤
              │
              └────────────────────────▶ RELEASED
                         release()
```

Terminal states cannot transition again. Retrying the operation that produced the terminal state is safe and returns `replayed: true`.

## Operation semantics

| Existing state | Operation               | Result                                                             |
| -------------- | ----------------------- | ------------------------------------------------------------------ |
| none           | `reserve`               | Creates a reservation and moves credits from available to reserved |
| any            | same `reserve` input    | Returns the existing reservation, including its current state      |
| any            | changed `reserve` input | `IDEMPOTENCY_CONFLICT`                                             |
| `RESERVED`     | `settle`                | Moves the actual amount to used and releases the remainder         |
| `SETTLED`      | same `settle` input     | Returns the settlement with `replayed: true`                       |
| `SETTLED`      | changed `settle` input  | `IDEMPOTENCY_CONFLICT`                                             |
| `RELEASED`     | `settle`                | `TRANSACTION_ALREADY_RELEASED`                                     |
| `RESERVED`     | `release`               | Returns all reserved credits to available                          |
| `RELEASED`     | `release`               | Returns the release with `replayed: true`                          |
| `SETTLED`      | `release`               | `TRANSACTION_ALREADY_SETTLED`                                      |

Grant idempotency uses a separate caller-provided `idempotencyKey`. Reusing that key with identical parameters returns the existing grant; changing any persisted parameter produces `IDEMPOTENCY_CONFLICT`.

## Invariants

Every committed grant satisfies:

```text
total = used + reserved + available
used >= 0
reserved >= 0
available >= 0
```

The initial release rejects settlement above the reserved amount. Overage is deliberately not implicit because silently creating a negative balance is a business policy, not a safe default.

Reservations use a project-scoped transaction lock, and reservations against the same customer wallet use a wallet lock plus row locks. This makes retries and competing reservations serialize before they change a balance.

Ledger entries are append-only. A reservation may create more than one entry when credits come from multiple grants, and a partial settlement creates both `SETTLE` and `RELEASE` entries.

## Automatic actions

`autoReleaseAfterSeconds` and `autoSettleAfterSeconds` are mutually exclusive. `settleDue()` finds due reservations and runs the same idempotent public operations used by callers:

- automatic release returns the entire reservation;
- automatic settlement charges the full reserved amount;
- concurrent scheduler workers are safe because terminal operations serialize on the transaction lock.
