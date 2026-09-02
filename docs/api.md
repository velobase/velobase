# HTTP API

The local Fastify server exposes the Velobase billing contract over JSON. Its machine-readable definition is [`openapi.json`](../openapi.json) and is also served at `GET /openapi.json` while the stack is running.

The server is an integration example, not an internet-facing gateway. It deliberately has no authentication, authorization, TLS, rate limiting, or tenant selection from requests. Put those controls in your own trusted adapter before production use.

## Conventions

- Requests and responses use JSON.
- Amounts are positive safe integers unless an operation explicitly allows zero. Choose the smallest unit your product needs and use it consistently.
- `wallet` defaults to `default`; `source` defaults to `default`.
- Tenant and project scope come from `VELOBASE_TENANT_ID` and `VELOBASE_PROJECT_ID` on the server, never from an untrusted request.
- Dates are RFC 3339 timestamps.
- Ledger pages are newest first. Treat `nextCursor` as opaque and pass it back unchanged as `cursor`.

## Run locally

```bash
pnpm dev
```

The API listens at `http://localhost:3000` and PostgreSQL listens at `localhost:54329`.

## Lifecycle example

Grant credits:

```bash
curl --request POST http://localhost:3000/v1/grants \
  --header 'content-type: application/json' \
  --data '{
    "customerId": "customer-123",
    "amount": 100,
    "idempotencyKey": "welcome-credit-123",
    "wallet": "video",
    "source": "welcome"
  }'
```

Reserve an estimate before starting work:

```bash
curl --request POST http://localhost:3000/v1/reservations \
  --header 'content-type: application/json' \
  --data '{
    "customerId": "customer-123",
    "amount": 100,
    "transactionId": "video-job-456",
    "wallet": "video"
  }'
```

Settle the actual cost and release the remainder:

```bash
curl --request POST http://localhost:3000/v1/reservations/video-job-456/settle \
  --header 'content-type: application/json' \
  --data '{"actualAmount": 67}'
```

Read the resulting balance and ledger:

```bash
curl 'http://localhost:3000/v1/balances/customer-123?wallet=video'
curl 'http://localhost:3000/v1/ledger?customerId=customer-123&wallet=video'
```

To abandon work without charging anything:

```bash
curl --request POST http://localhost:3000/v1/reservations/video-job-456/release
```

## Endpoints

| Method | Path                                      | Purpose                                       |
| ------ | ----------------------------------------- | --------------------------------------------- |
| `GET`  | `/health`                                 | Process health check                          |
| `GET`  | `/openapi.json`                           | OpenAPI 3.1 document                          |
| `POST` | `/v1/grants`                              | Create or replay a credit grant               |
| `POST` | `/v1/reservations`                        | Create or replay a reservation                |
| `POST` | `/v1/reservations/:transactionId/settle`  | Charge actual usage and release the remainder |
| `POST` | `/v1/reservations/:transactionId/release` | Return an uncharged reservation               |
| `GET`  | `/v1/balances/:customerId`                | Read balance and grant allocation             |
| `GET`  | `/v1/ledger`                              | Query append-only ledger entries              |

`POST /v1/demo/ai-video` exists only for the local Explorer and is intentionally excluded from the public API contract.

## Idempotency

`idempotencyKey` identifies a grant. `transactionId` identifies a reservation and every later operation on it. Repeating an operation with identical parameters returns the original result with `replayed: true`; reusing the same identity with different parameters returns `IDEMPOTENCY_CONFLICT`.

Generate identities outside the billing transaction and persist them with your job or order. Do not generate a new key on every retry.

## Errors

Errors have a stable machine-readable shape:

```json
{
  "error": {
    "name": "BillingError",
    "code": "INSUFFICIENT_BALANCE",
    "message": "insufficient available balance",
    "details": {}
  }
}
```

Important codes include `INVALID_ARGUMENT`, `INSUFFICIENT_BALANCE`, `IDEMPOTENCY_CONFLICT`, `TRANSACTION_NOT_FOUND`, `TRANSACTION_ALREADY_SETTLED`, `TRANSACTION_ALREADY_RELEASED`, and `INVARIANT_VIOLATION`.

Validation failures return HTTP 400, missing transactions return 404, balance or state conflicts return 409, and internal invariant failures return 500.

## Automatic terminal actions

The TypeScript engine supports `autoReleaseAfterSeconds` or `autoSettleAfterSeconds` when reserving. Call `billing.settleDue()` from a trusted scheduled worker to process due reservations. The local HTTP adapter does not expose this administrative operation.
