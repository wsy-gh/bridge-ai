# Bridge AI — Implementation Plan

## Phase 1: Foundation
- [ ] Initialize npm project, install dependencies
- [ ] Create `server.js` with Express setup, static file serving, EJS config
- [ ] Create `src/config.js` with model definitions and env vars
- [ ] Create Drizzle ORM schema (`src/schema/index.js`) — users, chats, messages tables
- [ ] Create `src/services/db.js` with SQLite setup and migration
- [ ] Create `public/css/style.css` with e-ink optimized styles
- [ ] Create `views/layout.ejs` base HTML template
- [ ] Create `.env.example` with required environment variables

## Phase 2: Authentication
- [ ] Create `src/routes/auth.js` — login, register, logout routes
- [ ] Create `src/middleware/auth.js` — session validation middleware
- [ ] Create `views/login.ejs` and `views/register.ejs`
- [ ] Set up `express-session` with SQLite session store
- [ ] Password hashing with bcrypt
- [ ] Login rate limiting (5 attempts / 15 min / IP)

## Phase 3: Core Chat Flow
- [ ] Create `src/routes/chat.js` — GET `/chats`, GET `/chat/new`, GET `/chat/:id`, POST `/chat/:id`
- [ ] Create `src/services/claude.js` — Anthropic SDK wrapper, streams internally, returns full response
- [ ] Create `src/services/markdown.js` — `marked` config for safe HTML with code block styling
- [ ] Create chat views: `chat.ejs`, `chat-list.ejs`, partials (header, message, thinking, input)
- [ ] Implement form POST → redirect → meta-refresh cycle (zero-JS flow)
- [ ] Track token usage per message (tokens_in, tokens_out)

## Phase 4: Polling Enhancement
- [ ] Create `src/routes/api.js` — `GET /api/chat/:chatId/status/:messageId` returns JSON `{status, html}`
- [ ] Create `public/js/poll.js` — ES5 XHR polling that replaces "Thinking..." with response HTML
- [ ] Wire meta-refresh to only activate when JS is unavailable (noscript or feature detection)

## Phase 5: Model Switching & Extended Thinking
- [ ] Model selector `<select>` in chat header, POSTs to `/chat/:id/settings`
- [ ] Extended thinking toggle (checkbox), stored per chat
- [ ] Gate model access by user tier (free = Haiku only, etc.)
- [ ] Display thinking content in `<details>` element with plain-div fallback
- [ ] Chat title auto-generation from first message

## Phase 6: Usage Limits & Pricing Enforcement
- [ ] Create `src/middleware/rateLimit.js` — per-user daily message limits by tier
- [ ] Daily message counter reset logic (messages_today, messages_reset_at)
- [ ] Friendly "limit reached" page with upgrade CTA
- [ ] Per-user token consumption tracking and display
- [ ] Admin view for usage stats (optional)

## Phase 7: Image Support
- [ ] Install `sharp`, create `src/services/images.js`
- [ ] Handle image content blocks from Claude API responses
- [ ] Convert SVG to PNG, optimize to grayscale for e-ink
- [ ] Create `src/routes/images.js` for serving processed images
- [ ] Display images inline in chat messages

## Phase 8: Polish & Production
- [ ] Error handling — API failures shown inline with retry link
- [ ] Chat pagination — show last 20 messages, "Load earlier" link
- [ ] Long response truncation with "Show full response" link
- [ ] Kindle UA detection middleware (`src/middleware/kindle.js`)
- [ ] HTTPS setup docs (Caddy reverse proxy config)
- [ ] Docker / docker-compose for deployment
- [ ] Test on actual Kindle browser (or closest WebKit simulator)

## Architecture Diagram

```
Kindle Browser  ──HTTP/HTML──▶  Express (Node.js)  ──SSE──▶  Claude API
  (ES5, cookies)                  │                          (Anthropic)
                                  ├── Session auth (cookies)
                                  ├── Rate limiting (per-user)
                                  ├── Token metering
                                  └── SQLite → PostgreSQL
                                      (Drizzle ORM)
```

## Pricing Tiers

| Tier | Price | Messages/Day | Models | Extended Thinking |
|------|-------|-------------|--------|-------------------|
| Free | $0 | 20 | Haiku | No |
| Basic | $5/mo | 100 | Haiku, Sonnet | No |
| Pro | $15/mo | 300 | All (incl. Opus) | Yes |
| Power | $30/mo | 1,000 | All | Yes |

## Per-Message API Cost (at ~3,700 tokens avg)

- Haiku: ~$0.004
- Sonnet: ~$0.011
- Opus: ~$0.037
