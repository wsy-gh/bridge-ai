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
| ORM | Drizzle ORM (SQLite initially, PostgreSQL at scale) |
| Claude API | @anthropic-ai/sdk |
| Markdown | marked (server-side rendering) |
| Image processing | sharp (SVG→PNG, grayscale, optimization) |
| Auth | express-session with bcrypt passwords |
| Rate limiting | express-rate-limit |

## E-Ink UI Rules

- Pure black (#000) on white (#FFF). No grays lighter than #555.
- Large tap targets: minimum 44x44px for all interactive elements.
- Single CSS file, under 5KB. No preprocessors.
- `font-family: serif` for body, `monospace` for code. No `@font-face`.
- Single column layout. No sidebar.
- Thick borders for visual separation (not shadows).
- `font-size: 16px+` on inputs to prevent zoom-on-focus.
- Images: `max-width: 100%`, served as grayscale PNG/JPG.

## Response Delivery Flow

1. User submits message via `<form>` POST
2. Server creates "pending" message, kicks off Claude API call (streams internally)
3. Server redirects to chat page showing "Thinking..." with `<meta http-equiv="refresh" content="3">`
4. **With JS**: ES5 script polls `GET /api/chat/:chatId/status/:messageId` every 3s via XHR
5. **Without JS**: Meta-refresh auto-reloads every 3s
6. Once response is complete, polling/refresh stops — no battery drain

## Multi-User & Pricing

- Session-based auth with secure cookies (Kindle supports cookies)
- Single shared Anthropic API key, server-managed
- Per-user token consumption tracking in DB
- Subscription tiers with daily message limits:
  - Free: 20 msgs/day, Haiku only
  - Basic ($5/mo): 100 msgs/day, Haiku + Sonnet
  - Pro ($15/mo): 300 msgs/day, all models including Opus
  - Power ($30/mo): 1000 msgs/day, all models, extended thinking

## File Structure

```
bridge-ai/
├── server.js                     # Entry point
├── src/
│   ├── config.js                 # Environment config, model definitions
│   ├── routes/
│   │   ├── auth.js               # Login, register, logout
│   │   ├── chat.js               # GET/POST /chat, /chat/:id
│   │   ├── api.js                # Polling endpoint
│   │   └── images.js             # Image serving
│   ├── services/
│   │   ├── claude.js             # Claude API wrapper
│   │   ├── markdown.js           # Server-side markdown rendering
│   │   ├── images.js             # Image processing
│   │   └── db.js                 # Database setup and CRUD
│   ├── middleware/
│   │   ├── auth.js               # Session auth middleware
│   │   ├── rateLimit.js          # Per-user rate limiting
│   │   └── kindle.js             # UA detection, Kindle-specific headers
│   └── schema/
│       └── index.js              # Drizzle ORM schema definitions
├── views/
│   ├── layout.ejs                # Base HTML template
│   ├── login.ejs                 # Login page
│   ├── register.ejs              # Registration page
│   ├── chat.ejs                  # Main chat view
│   ├── chat-list.ejs             # Chat history list
│   ├── partials/
│   │   ├── header.ejs            # Top bar: model selector, thinking toggle
│   │   ├── message.ejs           # Single message (user or assistant)
│   │   ├── thinking.ejs          # "Thinking..." placeholder
│   │   └── input.ejs             # Message input form
│   └── error.ejs                 # Error page
├── public/
│   ├── css/style.css             # Single e-ink optimized CSS (<5KB)
│   └── js/poll.js                # Optional ES5 polling (~2KB)
└── data/                         # SQLite DB (gitignored, created at runtime)
```

## Database Schema (Drizzle)

### Users
- id, email, password_hash, display_name, tier (free/basic/pro/power), messages_today, messages_reset_at, created_at

### Chats
- id, user_id, title, model, thinking_enabled, created_at, updated_at

### Messages
- id, chat_id, role (user/assistant), content, content_html, thinking, status (pending/streaming/complete/error), error, tokens_in, tokens_out, created_at

## Security

- Passwords hashed with bcrypt
- Session cookies: httpOnly, secure, sameSite: 'lax'
- Login rate limiting: 5 attempts per 15 min per IP
- HTML from Claude markdown sanitized server-side (strip script tags, event handlers)
- API key in .env only, never in code or database
- HTTPS required in production (Caddy reverse proxy with auto Let's Encrypt)

## Code Style

- Functional patterns, pure functions over classes
- Explicit descriptive variable names
- Early returns over nested conditionals
- Conventional Commits (feat:, fix:, chore:, refactor:, docs:)
