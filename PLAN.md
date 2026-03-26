# Bridge AI — Implementation Plan

## Phase 0: Infrastructure & DevOps
- [ ] Initialize npm project, install all dependencies
- [ ] Set up Neon PostgreSQL database (create project, get connection string)
- [ ] Set up Upstash Redis (create database, get credentials)
- [ ] Create `src/config.js` with env validation (fail fast on missing vars)
- [ ] Create Drizzle ORM schema (`src/schema/index.js`) — users, chats, messages, tiers, usage_logs tables
- [ ] Create `src/services/db.js` with Neon PostgreSQL connection via Drizzle
- [ ] Set up `pino` structured logging
- [ ] Create `src/routes/health.js` — `GET /health` with DB + Redis ping
- [ ] Add graceful shutdown handler in `server.js`
- [ ] Set up Sentry error tracking (`@sentry/node`)
- [ ] Deploy to Railway/Render with auto-deploy from main branch
- [ ] Update `.env.example` with all service credentials

## Phase 1: Foundation
- [ ] Create `server.js` with Express, helmet, static files, EJS, pino-http
- [ ] Create `public/css/style.css` with e-ink optimized styles (<5KB)
- [ ] Create `views/layout.ejs` base HTML template
- [ ] Create `views/error.ejs` error page
- [ ] Seed `tiers` table with initial pricing tiers (Free, Basic, Pro, Power)

## Phase 2: Authentication
- [ ] Create `src/routes/auth.js` — login, register, logout routes
- [ ] Create `src/middleware/auth.js` — session validation middleware
- [ ] Create `views/login.ejs` and `views/register.ejs`
- [ ] Set up `express-session` with `connect-redis` (Upstash Redis)
- [ ] Password hashing with bcrypt (cost factor 12)
- [ ] Login rate limiting via `@upstash/ratelimit` (5 attempts / 15 min / IP)

## Phase 3: Core Chat Flow
- [ ] Create `src/routes/chat.js` — GET `/chats`, GET `/chat/new`, GET `/chat/:id`, POST `/chat/:id`
- [ ] Create `src/services/claude.js` — Anthropic SDK wrapper with circuit breaker (3 failures → 30s cooldown)
- [ ] Create `src/services/markdown.js` — `marked` config + `isomorphic-dompurify` sanitization
- [ ] Create chat views: `chat.ejs`, `chat-list.ejs`, partials (header, message, thinking, input)
- [ ] Implement form POST → redirect → meta-refresh cycle (zero-JS flow)
- [ ] Track token usage per message — log to `usage_logs` table, update `tokens_used_today`

## Phase 4: Polling Enhancement
- [ ] Create `src/routes/api.js` — `GET /api/chat/:chatId/status/:messageId` returns JSON `{status, html}`
- [ ] Create `public/js/poll.js` — ES5 XHR polling with exponential backoff (2s, 4s, 8s, 15s cap)
- [ ] Wire meta-refresh to only activate when JS is unavailable (noscript or feature detection)

## Phase 5: Model Switching & Extended Thinking
- [ ] Model selector `<select>` in chat header, POSTs to `/chat/:id/settings`
- [ ] Extended thinking toggle (checkbox), stored per chat
- [ ] Gate model access by tier's `allowed_models` (loaded from `tiers` table)
- [ ] Gate thinking by tier's `thinking_enabled`
- [ ] Token budget check BEFORE API call — estimate cost, reject if over daily budget
- [ ] Display thinking content in `<details>` element with plain-div fallback
- [ ] Chat title auto-generation (first 50 chars of first message, no extra API call)

## Phase 6: Stripe Billing
- [ ] Set up Stripe products/prices matching `tiers` table entries
- [ ] Create `src/routes/billing.js` — server-rendered upgrade/manage pages
- [ ] Stripe Checkout integration (server-side redirect, no client JS required)
- [ ] Stripe webhook handler: `customer.subscription.created/updated/deleted`
- [ ] Sync tier changes from Stripe webhooks → `users.tier_id` in database
- [ ] Create `views/billing.ejs` — subscription management page
- [ ] Create `views/usage.ejs` — daily token usage dashboard (tokens used/remaining)
- [ ] "Limit reached" page with Stripe Checkout upgrade link
- [ ] Daily token budget reset logic (on-demand check when `tokens_reset_at` has passed)

## Phase 7: Image Support (Cloudinary)
- [ ] Set up Cloudinary account, add credentials to `.env`
- [ ] Create `src/services/images.js` — upload to Cloudinary with URL-based transforms (grayscale, resize, format)
- [ ] Handle image content blocks from Claude API responses
- [ ] Serve images via Cloudinary URL with e-ink optimized transforms (no local storage)
- [ ] Display images inline in chat messages (`<img>` with Cloudinary URL)

## Phase 8: Polish & Production
- [ ] Error handling — API failures shown inline with retry link, circuit breaker prevents cascade
- [ ] Chat pagination — show last 20 messages, "Load earlier" link
- [ ] Long response truncation with "Show full response" link
- [ ] Kindle UA detection middleware (`src/middleware/kindle.js`)
- [ ] Set up Better Stack uptime monitoring + log drain from pino
- [ ] Set up Resend for transactional email (password resets, usage alerts)
- [ ] Test on actual Kindle browser (or closest WebKit 534 simulator)

## Architecture Diagram

```
Kindle Browser  ──HTTP/HTML──▶  Express (Node.js)  ──API──▶  Claude API
  (ES5, cookies)                  │                          (Anthropic)
                                  ├── Session auth (Upstash Redis)
                                  ├── Rate limiting (Upstash Rate Limit)
                                  ├── Token metering (usage_logs)
                                  ├── Neon PostgreSQL (Drizzle ORM)
                                  ├── Stripe Billing (webhooks)
                                  ├── Cloudinary (image transforms)
                                  ├── Sentry (error tracking)
                                  ├── Better Stack (logs + uptime)
                                  └── Resend (transactional email)
```

## Pricing Tiers (token-budget based)

| Tier | Price | Daily Token Budget | Models | Thinking |
|------|-------|--------------------|--------|----------|
| Free | $0 | 50K tokens | Haiku | No |
| Basic | $5/mo | 200K tokens | Haiku, Sonnet | No |
| Pro | $15/mo | 500K tokens | All (incl. Opus) | Yes |
| Power | $30/mo | 2M tokens | All | Yes |

## Per-Token API Cost (approx)

- Haiku: ~$0.001/1K tokens
- Sonnet: ~$0.003/1K tokens
- Opus: ~$0.015/1K tokens
- Extended thinking: ~10x base cost

## Cost Controls

- Token budget enforced BEFORE API call (estimate input + avg output)
- Actual usage tracked AFTER response in `usage_logs`
- Per-model gating prevents free-tier users from accessing expensive models
- Extended thinking gated by tier (separate from regular token budget)
- Circuit breaker prevents runaway API costs during outages
