# @velobase/billing

The framework-agnostic usage credit engine that powers Velobase.

The package is under active extraction and is not published yet. Its public contract uses five operations:

```text
grant → reserve → settle
                ↘ release
```

- `grant` creates an expiring or non-expiring credit bucket.
- `reserve` safely holds an estimated amount for a job.
- `settle` charges the actual amount and returns the unused reservation.
- `release` returns a reservation without charging it.
- `getBalance` and `listLedger` explain the resulting balance.
