# Wavely — WhatsApp SaaS (React + Vite · NestJS · OpenWA)

Multi-tenant WhatsApp platform: each customer signs up, connects one or more WhatsApp numbers (QR pairing),
imports contacts, sends/schedules campaigns, answers from a shared inbox, and can let AI reply automatically.

```
frontend/   React 18 + Vite + TypeScript (Recharts, qrcode.react)
backend/    NestJS 10 + TypeORM (SQLite) + JWT auth
            └─ talks to OpenWA over REST, receives events via webhook
```

## Features

| Area | What's there |
|---|---|
| Auth | Register, login, JWT sessions, profile editing, password change |
| Numbers | Multiple WhatsApp numbers per account (plan cap via `MAX_NUMBERS_PER_USER`), QR pairing modal with live status, restart, remove |
| Contacts | CRUD, tags, search/filter, CSV import, bulk delete |
| Campaigns | Audience by all/tags, `{{name}}` personalisation, **send now or schedule**, throttled sending with randomised delay, live progress, per-recipient status, cancel |
| Inbox | Conversations across numbers, threaded view, manual replies, **AI-suggested reply** button |
| AI | Per-number toggle + custom instructions; auto-replies to inbound text via webhook. Anthropic or any OpenAI-compatible API |
| Analytics | Delivery rate, sent/received/AI volume over 7–30 days, AI-handled share, per-campaign results |

## Run it

**Prerequisites:** Node 20+, a running OpenWA instance ([Deckasoft/OpenWA](https://github.com/Deckasoft/OpenWA), API on `:2785` by default).

```bash
# 1) Backend
cd backend
cp .env.example .env        # fill JWT_SECRET, WEBHOOK_SECRET, OPENWA_*, AI_API_KEY
npm install
npm run build               # <- run this first: type-checks everything
npm run start:dev           # http://localhost:3000/api

# 2) Frontend
cd ../frontend
npm install
npm run build               # <- type-checks (tsc --noEmit) then bundles
npm run dev                 # http://localhost:5173 (proxies /api to :3000)
```

Or with Docker: `cp backend/.env.example .env && docker compose up --build` → http://localhost:8080
(OpenWA is run separately; set `OPENWA_URL` accordingly).

### Webhooks need a reachable URL
OpenWA calls your backend at `PUBLIC_URL/api/webhooks/openwa/:numberId?secret=…` to deliver incoming messages
and connection status. `PUBLIC_URL` must be reachable **from the OpenWA server** (same Docker network, a LAN IP, or a
tunnel like ngrok/cloudflared while developing). Without it, sending works but the inbox and AI replies stay empty.

## ⚠️ Important notes

**1. This code was not compiled or run when it was written.** The build environment blocked the npm registry, so
dependencies were never installed. Only a syntax check passed. Expect to fix a few type errors or typos on first
`npm run build` — the structure is sound but treat it as a first draft.

**2. The OpenWA adapter is an assumption.** All OpenWA specifics live in one file:
`backend/src/core/openwa.service.ts` (plus payload parsing in `webhooks.controller.ts → extract()`).
I coded against the endpoints in the OpenWA README (`POST /sessions`, `/sessions/:id/start`, `GET /sessions/:id/qr`,
`POST /sessions/:id/messages/send-text` with `{chatId, text}`, `POST /sessions/:id/webhooks`, header `X-API-Key`).
Check them against your instance's Swagger at `/api/docs` and adjust response-field names if they differ.
If you meant the older `open-wa/wa-automate` Easy API instead, only this adapter needs rewriting.

**3. WhatsApp ban risk.** Automated bulk messaging through unofficial gateways can get numbers banned. The app
throttles (3–120 s between messages, ±30 % jitter) but only message people who opted in. For a commercial SaaS,
consider the official WhatsApp Business Cloud API as a second driver behind the same adapter interface.

## Before production

- Replace TypeORM `synchronize: true` with migrations; move SQLite → PostgreSQL (needs `datetime` → `timestamp` column types).
- Campaign sending runs in-process (`@nestjs/schedule` every 30 s, resumes after restart). For multiple backend instances or heavy load, move to a queue (BullMQ + Redis).
- Add rate limiting (`@nestjs/throttler`), helmet, email verification / password reset, and billing/plan enforcement.
- Inbox conversation grouping loads the latest 2 000 messages in memory; switch to a SQL `GROUP BY` for large tenants.
- Text messages only for now; media, templates and delivery receipts are natural next additions.

## API overview (all under `/api`, JWT bearer except auth/webhooks)

`POST /auth/register|login` · `GET|PATCH /auth/me` · `POST /auth/password`
`GET|POST /numbers` · `GET /numbers/:id/qr` · `PATCH|DELETE /numbers/:id`
`GET|POST /contacts` · `POST /contacts/import|bulk-delete` · `PATCH|DELETE /contacts/:id`
`GET|POST /campaigns` · `GET /campaigns/:id` · `POST /campaigns/:id/start|schedule|cancel` · `DELETE /campaigns/:id`
`GET /inbox/conversations` · `GET /inbox/thread/:numberId/:chatId` · `POST /inbox/reply|suggest`
`GET /analytics/overview?days=14` · `POST /webhooks/openwa/:numberId` (public, secret-protected)
