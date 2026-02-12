# Velobase

**Production-proven AI SaaS infrastructure. Ship fast, skip the boilerplate.**

Velobase is an AI product starter kit extracted from a real, revenue-generating production system. Every module — billing, payments, subscriptions, admin panel — has been battle-tested with real users and real money. Think ShipFast, but purpose-built for AI products.

> Not a toy. Not a demo. This is infrastructure that has processed real payments, managed real subscriptions, and served real AI workloads.

## What You Get

### Billing Engine

Multi-account credit & quota system with transactional guarantees.

- **Freeze → Consume → Unfreeze** workflow for safe credit operations
- Multiple account types: free trial, membership, order, promo, daily login
- FEFO (First Expire, First Out) debit algorithm across accounts
- Idempotent operations via `businessId` — no double charges
- Account lifecycle management: `PENDING → ACTIVE → EXPIRED / DEPLETED`
- Balance snapshots and transaction history

### Payment Gateway

Multi-provider payment abstraction — plug in any gateway without touching business logic.

- **Stripe** — Cards, subscriptions, saved card direct charge
- **Airwallex** — Multi-currency international payments
- **NOWPayments** — Crypto payments
- **Telegram Stars** — Telegram in-app payments
- Provider registry pattern: implement `PaymentProvider` interface to add new gateways
- Idempotent webhook handling with deduplication
- Immutable `PaymentTransaction` records (cashflow audit trail)
- Multi-currency pricing: USD, EUR, GBP, CHF, AUD with country-based resolution
- Order types: new purchase, upgrade, downgrade, renewal, promo grant

### Subscription & Entitlements

Full subscription lifecycle with plan tiers and feature gating.

- Plans: FREE → STARTER → PLUS → PREMIUM (configurable)
- Trial periods with automatic conversion
- Billing cycles with per-cycle credit grants
- Entitlement types: `BOOLEAN` (feature flags), `LIMIT` (quotas), `LEVEL` (tiers)
- Cancel-at-period-end, immediate cancellation, early trial conversion
- Immutable plan snapshots at subscription time

### Fulfillment System

Pluggable order fulfillment — triggered by successful payment webhooks.

- Strategy pattern: `Fulfiller` interface with `canHandle()` + `fulfill()`
- Built-in fulfillers: credits package, subscription activation, one-time entitlements
- Payment-driven: hooks into webhook pipeline
- Idempotent: safe to retry without side effects

### Product Catalog

Multi-currency product management with pricing and availability.

- Product types: subscription, one-time entitlement, credits package
- Multi-currency `ProductPrice` model with country-based resolution
- Product snapshots frozen in orders (immutable at purchase time)
- Soft deletes for audit compliance
- Admin CRUD with availability toggles

### Promo Code System

Code-based promotions with concurrency-safe redemption.

- Grant types: credit grants or product grants
- Usage limits: global cap + per-user cap
- Time-bounded: `startsAt` / `expiresAt`
- `pg_advisory_xact_lock` for race-condition-free redemption
- Integrated with billing (credit grants) and fulfillment (product grants)

### Auth & Security

NextAuth 5 with production-grade abuse prevention.

- Providers: Google OAuth, Email magic link, password (allowlist)
- Email normalization: Gmail alias & dot-trick deduplication
- Disposable email domain blocking
- Cloudflare Turnstile bot protection
- Rate limiting: 3 emails/hr per email, 10/hr per IP
- Signup flow: initial credit grants, device detection, referral binding, UTM attribution
- JWT sessions with user metadata injection

### Rate Limiting & Concurrency

Tiered, Redis-backed rate limiting with concurrency gates.

- User-level: tier-based limits (FREE: 20/min, PLUS: 120/min, configurable)
- IP-level: fallback for unauthenticated requests
- Guest rate limiting: per guest ID + IP
- Concurrency slots: `acquireChatSlot` / `releaseChatSlot` for max parallel operations
- Sliding window algorithm via `rate-limiter-flexible`

### Storage

S3-compatible multi-provider storage abstraction.

- Providers: AWS S3, Cloudflare R2, Aliyun OSS, Google Cloud Storage, MinIO
- Presigned URLs for upload and download
- CDN integration with configurable base URL
- Structured key generation: `{userId}/{type}/{id}/{variant}.{ext}`
- Download-and-reupload utility for external URLs

### AI Chat Engine

Event-sourcing chat architecture with agent framework.

- **Interaction tree**: immutable events with `parentId` branching (supports variants & edits)
- Interaction types: `user_message`, `ai_message`, `document_processing`, `message_edit`
- Projection engine: transform interaction tree → linear `UIMessage[]` for UI
- Agent system: system agents + user-customizable agents with tools
- Tool registry: factory-based, context-aware tool preparation
- File attachment processing: PDF, DOCX → Markdown conversion
- Streaming: Vercel AI SDK with back-pressure
- Guest support with separate rate limiting

### Admin Panel

Full-featured back-office for operations and customer support.

- **Users**: list, search, detail view, block/unblock, related accounts detection, delete
- **Orders**: list with filters, detail view, payment info, per-user order history, stats
- **Credits**: per-user credit view, manual grant/deduct, billing record history
- **Products**: catalog management, price editing, availability toggle, Airwallex sync
- **Promo Codes**: CRUD, usage tracking
- **Subscriptions**: managed through user detail view
- **Affiliate**: commission tracking, payout management (approve/reject/complete)
- **Works**: content moderation, video management, task promotion
- **Touches**: scene/template/schedule management for user engagement
- Role-based access: `isAdmin` flag in JWT, `adminProcedure` middleware, layout-level redirect

### tRPC API Layer

End-to-end type-safe API with composable middleware.

- Procedures: `publicProcedure`, `protectedProcedure`, `adminProcedure`, `rateLimitedProcedure`
- Context: session, database, client IP, headers — injected automatically
- Zod validation on all inputs
- Structured error handling with `TRPCError`
- Superjson serialization (Date, BigInt, etc.)
- Timing middleware for performance monitoring

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode, `noUncheckedIndexedAccess`) |
| API | tRPC v11 |
| Database | PostgreSQL + Prisma |
| Cache & Queue | Redis + BullMQ |
| Auth | NextAuth v5 |
| AI | Vercel AI SDK |
| Payments | Stripe, Airwallex, NOWPayments, Telegram Stars |
| Storage | S3-compatible (AWS, R2, OSS, GCS, MinIO) |
| UI | TailwindCSS + Radix UI |
| Logging | Pino (structured, dual output in dev) |
| Analytics | PostHog |

## Architecture Patterns

These patterns are consistent across all modules:

- **Service layer** — Business logic lives in services, route handlers stay thin
- **Transactional safety** — Prisma `$transaction` for all multi-step mutations
- **Idempotency** — `businessId`, `uniqueKey`, advisory locks prevent duplicates
- **Zod schemas** — Runtime validation on every boundary
- **Soft deletes** — `deletedAt` for audit trail, never hard delete
- **Snapshots** — Product/plan state frozen at order/subscription time
- **Provider pattern** — Pluggable implementations (payment, fulfillment, storage)
- **Event sourcing** — Chat interactions as immutable events with tree structure
- **Projection pattern** — Transform stored events → view models

## Project Structure

```
src/
├── app/
│   ├── admin/           # Admin panel (pages + layout)
│   ├── api/             # API routes (auth, tRPC, webhooks, chat)
│   └── [pages]/         # Public pages
├── modules/
│   └── ai-chat/         # AI chat module (components, hooks, server)
├── components/
│   ├── ui/              # Radix UI component library
│   ├── admin/           # Admin panel components
│   └── auth/            # Auth components
├── server/
│   ├── admin/           # Admin routers & procedures
│   ├── billing/         # Credit/quota billing engine
│   ├── order/           # Order processing & payment providers
│   ├── membership/      # Subscriptions & entitlements
│   ├── product/         # Product catalog
│   ├── promo/           # Promo code system
│   ├── fulfillment/     # Order fulfillment providers
│   ├── auth/            # NextAuth config & security
│   ├── api/             # tRPC routers & middleware
│   │   └── tools/       # AI agent tool registry
│   ├── lib/             # Shared server utilities
│   ├── db.ts            # Prisma client
│   ├── redis.ts         # Redis client
│   ├── ratelimit.ts     # Rate limiting
│   └── storage.ts       # S3 storage abstraction
├── lib/                 # Shared libraries (logger, utils)
├── stores/              # Zustand state management
└── env.js               # Environment validation (t3-env)

prisma/
├── schema.prisma        # Database schema
└── migrations/          # Migration history
```

## Getting Started

```bash
pnpm install
cp .env.example .env     # Configure your environment
pnpm db:push             # Push schema to database
pnpm db:seed             # Seed initial data
pnpm dev                 # Start development server
```

## License

Private — All rights reserved.
