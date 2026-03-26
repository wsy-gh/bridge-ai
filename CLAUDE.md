# Bridge AI

Kindle-optimized Claude AI chat interface — a web bridge for e-ink browsers.

## Project Overview

A server-rendered web app that lets Kindle e-reader users chat with Claude AI through the Kindle's basic browser (WebKit 531-534, ~Safari 4 era). The server acts as a full middleman proxy since the Kindle browser cannot call APIs directly.

## Architecture Constraints (MUST follow)

- **Server-rendered HTML only** — Express.js + EJS templates. No SPAs, no React/Vue/Svelte.
- **ES5 JavaScript only on client** — no Promises, no arrow functions, no const/let, no template literals, no fetch(). Use XMLHttpRequest.
- **No SSE or WebSocket on client** — Kindle doesn't support them. Use long polling or meta-refresh.
- **jQuery is OK** (confirmed working on Kindle Paperwhite 3+), but keep it minimal (~100ms parse cost on Kindle).
- **Progressive enhancement** — app must work with zero JS (form POST + meta-refresh). JS is an optional upgrade.
- **No web fonts, no SVG** — use system fonts (`serif` body, `monospace` code). Convert SVG to PNG server-side.
- **No CSS flexbox/grid** — use floats/tables for layout. Kindle WebKit doesn't support them.
- **No animations or transitions** — e-ink has 200-300ms refresh, animations look terrible.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js (>=18) |
| Framework | Express.js |
| Templating | EJS |
| ORM | Drizzle ORM (PostgreSQL via Neon) |
| Database | Neon (serverless PostgreSQL) |
| Session Store | Upstash Redis (serverless) via connect-redis |
| Claude API | @anthropic-ai/sdk |
| Markdown | marked (server-side) + isomorphic-dompurify (sanitization) |
| Image processing | Cloudinary (URL-based transforms, grayscale, resize) |
| Auth | express-session with bcrypt passwords |
| Rate limiting | @upstash/ratelimit (distributed, via Upstash Redis) |
| Payments | Stripe Billing (subscriptions, webhooks) |
| Email | Resend (password resets, usage alerts) |
| Logging | pino + pino-http (structured JSON logs) |
| Error tracking | Sentry (@sentry/node) |
| Security headers | helmet |
| Deployment | Railway or Render (PaaS, auto-deploy from git) |

## Third-Party Services

All third-party services are server-side only. The Kindle browser never contacts them directly — Express mediates everything. This means zero Kindle compatibility impact.

| Service | Purpose | Free Tier | Scaled Cost |
|---------|---------|-----------|-------------|
| Neon | Serverless PostgreSQL | 0.5GB storage | ~$19-69/mo |
| Upstash | Redis for sessions + rate limiting | 10K commands/day | ~$10-50/mo |
| Stripe | Subscription billing | No monthly fee | 2.9% + 30c/txn |
| Cloudinary | Image transforms (grayscale, resize, SVG→PNG) | 25K transforms/mo | ~$25-89/mo |
| Sentry | Error tracking + alerting | 5K errors/mo | ~$26/mo |
| Better Stack | Log aggregation + uptime monitoring | 1GB logs/mo | ~$25/mo |
| Resend | Transactional email | 3K emails/mo | ~$20/mo |
| Railway/Render | PaaS hosting (auto-deploy, SSL) | Limited | ~$7-100/mo |

**Estimated infra cost**: ~$7/mo (100 users) → ~$50-100/mo (1K users) → ~$300-400/mo (10K users)

## E-Ink UI Rules

- Pure black (#000) on white (#FFF). No grays lighter than #555.
- Large tap targets: minimum 44x44px for all interactive elements.
- Single CSS file, under 5KB. No preprocessors.
- `font-family: serif` for body, `monospace` for code. No `@font-face`.
- Single column layout. No sidebar.
- Thick borders for visual separation (not shadows).
- `font-size: 16px+` on inputs to prevent zoom-on-focus.
- Images: `max-width: 100%`, served as grayscale PNG/JPG via Cloudinary.

## Response Delivery Flow

1. User submits message via `<form>` POST
2. Server estimates token cost, checks user's daily budget — rejects if over limit
3. Server creates "pending" message, kicks off Claude API call (streams internally)
4. Server redirects to chat page showing "Thinking..." with `<meta http-equiv="refresh" content="3">`
5. **With JS**: ES5 script polls `GET /api/chat/:chatId/status/:messageId` with exponential backoff (2s, 4s, 8s, 15s cap) via XHR
6. **Without JS**: Meta-refresh auto-reloads every 3s
7. Once response is complete, polling/refresh stops — no battery drain
8. Server logs actual token usage to `usage_logs` table, updates user's daily budget

## Multi-User & Pricing

- Session-based auth with secure cookies (Kindle supports cookies)
- Single shared Anthropic API key, server-managed
- Per-user token consumption tracking in DB
- **Token-budget** rate limiting (not message counts) — prevents cost abuse
- Subscription tiers managed via Stripe Billing, stored in database `tiers` table:

| Tier | Price | Daily Token Budget | Models | Thinking |
|------|-------|--------------------|--------|----------|
| Free | $0 | 50K tokens | Haiku | No |
| Basic | $5/mo | 200K tokens | Haiku, Sonnet | No |
| Pro | $15/mo | 500K tokens | All (incl. Opus) | Yes |
| Power | $30/mo | 2M tokens | All | Yes |

Token budget enforcement:
- **Before API call**: Estimate cost (input tokens + model's avg output). Reject if would exceed daily budget.
- **After response**: Record actual usage in `usage_logs`. Update `tokens_used_today`.
- **Daily reset**: Cron or on-demand reset when `tokens_reset_at` has passed.

## File Structure

```
bridge-ai/
├── server.js                     # Entry point (Express, helmet, pino-http, graceful shutdown)
├── src/
│   ├── config.js                 # Env validation, model definitions, tier defaults
│   ├── routes/
│   │   ├── auth.js               # Login, register, logout
│   │   ├── chat.js               # GET/POST /chat, /chat/:id
│   │   ├── api.js                # Polling endpoint
│   │   ├── billing.js            # Stripe Checkout, subscription management, webhooks
│   │   └── health.js             # GET /health (DB + Redis connectivity check)
│   ├── services/
│   │   ├── claude.js             # Claude API wrapper with circuit breaker
│   │   ├── markdown.js           # marked + DOMPurify server-side rendering
│   │   ├── images.js             # Cloudinary upload + transform (grayscale, resize)
│   │   └── db.js                 # Neon PostgreSQL connection + Drizzle setup
│   ├── middleware/
│   │   ├── auth.js               # Session auth middleware
│   │   ├── rateLimit.js          # Token-budget enforcement via Upstash
│   │   └── kindle.js             # UA detection, Kindle-specific headers
│   └── schema/
│       └── index.js              # Drizzle ORM schema (users, chats, messages, tiers, usage_logs)
├── views/
│   ├── layout.ejs                # Base HTML template
│   ├── login.ejs                 # Login page
│   ├── register.ejs              # Registration page
│   ├── chat.ejs                  # Main chat view
│   ├── chat-list.ejs             # Chat history list
│   ├── billing.ejs               # Subscription management page
│   ├── usage.ejs                 # Daily token usage dashboard
│   ├── partials/
│   │   ├── header.ejs            # Top bar: model selector, thinking toggle
│   │   ├── message.ejs           # Single message (user or assistant)
│   │   ├── thinking.ejs          # "Thinking..." placeholder
│   │   └── input.ejs             # Message input form
│   └── error.ejs                 # Error page
├── public/
│   ├── css/style.css             # Single e-ink optimized CSS (<5KB)
│   └── js/poll.js                # Optional ES5 polling with exponential backoff (~2KB)
└── drizzle/                      # Drizzle migration files (auto-generated)
```

## Database Schema (Drizzle + Neon PostgreSQL)

### Users
- id, email, password_hash, display_name
- tier_id (FK → tiers), stripe_customer_id, stripe_subscription_id
- tokens_used_today, tokens_reset_at
- created_at

### Tiers (database-driven, not hardcoded)
- id, name, stripe_price_id
- daily_token_budget, allowed_models (JSON array), thinking_enabled
- created_at

### Chats
- id, user_id, title, model, thinking_enabled, created_at, updated_at

### Messages
- id, chat_id, role (user/assistant), content, content_html
- thinking, thinking_tokens
- status (pending/streaming/complete/error), error
- tokens_in, tokens_out, created_at

### Usage Logs (audit trail)
- id, user_id, chat_id, message_id
- model, tokens_in, tokens_out, thinking_tokens, estimated_cost_cents
- created_at

## Operational Infrastructure

### Health Check
- `GET /health` returns `{ status: "ok", db: true, redis: true }` with DB ping and Redis ping
- Used by Railway/Render for readiness checks and Better Stack for uptime monitoring

### Graceful Shutdown
- On SIGTERM: stop accepting new requests, wait for in-flight requests (30s timeout), close DB/Redis connections, then exit
- Prevents dropped requests during deploys

### Environment Validation
- On startup, validate all required env vars exist and are correctly formatted
- Fail fast with clear error message listing missing vars (don't silently start with broken config)

### Structured Logging
- JSON logs via `pino` with `requestId`, `userId`, `chatId` fields for traceability
- `pino-http` middleware for automatic request/response logging
- Log all Claude API calls with model, tokens, latency
- Pipe to Better Stack via log drain for search and alerting

### Circuit Breaker (Claude API)
- After 3 consecutive Claude API failures, open circuit for 30 seconds
- During open circuit: return cached error page immediately (don't queue requests)
- After 30s: allow one probe request. If succeeds, close circuit. If fails, re-open.

## Security

- Passwords hashed with bcrypt (cost factor 12)
- Session cookies: httpOnly, secure, sameSite: 'lax'
- Sessions stored in Upstash Redis (auto-expiry, no cleanup needed)
- Login rate limiting: 5 attempts per 15 min per IP (via Upstash Rate Limit)
- HTML from Claude markdown sanitized with `DOMPurify` (via `isomorphic-dompurify`)
- Security headers via `helmet` middleware
- `Content-Security-Policy`: `default-src 'self'; img-src 'self' https://res.cloudinary.com`
- API key in .env only, never in code or database
- Stripe webhooks verified via `stripe.webhooks.constructEvent` with signing secret
- HTTPS required in production (handled by Railway/Render automatically)

## Code Style

- Functional patterns, pure functions over classes
- Explicit descriptive variable names
- Early returns over nested conditionals
- Conventional Commits (feat:, fix:, chore:, refactor:, docs:)
