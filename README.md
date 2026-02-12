# Velobase

**Ship AI products at lightning speed.**

Velobase is an open-core AI infrastructure toolkit that gives you everything you need to go from idea to production AI product — in days, not months. Think of it as the **ShipFast for AI**: batteries-included, opinionated, and built for velocity.

## Why Velobase?

Building AI products means juggling LLM orchestration, billing, auth, storage, rate limiting, and more — before you even get to the product itself. Velobase solves this by providing a production-ready foundation so you can focus on what makes your AI product unique.

## Features

### Core Infrastructure
- **AI Gateway** — Unified API for OpenAI, Anthropic, Google, and 50+ LLM providers with automatic fallback, load balancing, and cost tracking
- **Streaming Engine** — First-class SSE/WebSocket streaming with back-pressure, reconnection, and client SDKs
- **Auth & Identity** — Plug-and-play authentication (OAuth, magic link, API keys) with multi-tenant support

### AI-Native Primitives
- **Agent Framework** — Build, compose, and deploy AI agents with tool calling, memory, and guardrails
- **RAG Pipeline** — End-to-end retrieval-augmented generation with vector store integrations (Pinecone, Qdrant, pgvector)
- **Prompt Management** — Version-controlled prompts with A/B testing, evaluations, and rollback

### Business Layer
- **Usage-Based Billing** — Metered billing with credit systems, quotas, and Stripe integration out of the box
- **Rate Limiting** — Tiered rate limits per user/plan with Redis-backed sliding windows
- **Subscription Management** — Plans, trials, upgrades, and entitlements with zero custom code

### Developer Experience
- **Type-Safe API** — End-to-end TypeScript with tRPC, Zod validation, and generated client SDKs
- **Observability** — Structured logging, OpenTelemetry tracing, and LLM cost/latency dashboards
- **One-Click Deploy** — Deploy to Vercel, Railway, Fly.io, or Docker with a single command

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| API | tRPC v11 |
| Database | PostgreSQL + Prisma |
| Cache & Queue | Redis + BullMQ |
| Auth | NextAuth v5 |
| AI SDK | Vercel AI SDK |
| Payments | Stripe |
| Storage | S3-compatible (AWS, R2, MinIO) |
| Deployment | Docker / Vercel / Railway |

## Quick Start

```bash
# Clone the repo
git clone https://github.com/velobase/velobase.git
cd velobase

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Set up database
pnpm db:push

# Start development
pnpm dev
```

## Project Structure

```
velobase/
├── packages/
│   ├── core/          # Core infrastructure (gateway, streaming, auth)
│   ├── ai/            # AI primitives (agents, RAG, prompts)
│   ├── billing/       # Usage-based billing & subscriptions
│   └── ui/            # Pre-built UI components
├── apps/
│   ├── web/           # Next.js starter app
│   ├── docs/          # Documentation site
│   └── dashboard/     # Admin dashboard
├── templates/         # Starter templates
│   ├── chatbot/       # AI chatbot template
│   ├── copilot/       # Code copilot template
│   └── saas/          # Full SaaS template
└── tools/
    ├── cli/           # Velobase CLI
    └── sdk/           # Client SDKs
```

## Templates

Get started instantly with pre-built templates:

| Template | Description |
|----------|-------------|
| `velobase create chatbot` | AI chatbot with streaming, memory, and tool use |
| `velobase create copilot` | Code assistant with RAG and inline suggestions |
| `velobase create saas` | Full SaaS with auth, billing, and AI features |
| `velobase create api` | Headless AI API with gateway and rate limiting |

## Roadmap

- [x] Core infrastructure (auth, billing, storage)
- [ ] AI Gateway with multi-provider support
- [ ] Agent framework with tool calling
- [ ] RAG pipeline with vector store integrations
- [ ] CLI and project scaffolding
- [ ] Hosted cloud platform (Velobase Cloud)
- [ ] Marketplace for plugins and templates

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) — use it for anything, commercial or personal.

---

<p align="center">
  <strong>Built with ❤️ for the AI builder community</strong><br>
  <a href="https://velobase.io">Website</a> · <a href="https://docs.velobase.io">Docs</a> · <a href="https://discord.gg/velobase">Discord</a> · <a href="https://twitter.com/velobase">Twitter</a>
</p>
