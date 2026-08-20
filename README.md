# AI Business Agent

Multi-tenant NestJS backend and React frontend for knowledge-base RAG, Gmail/Twilio communication, and CRM-style tenant data.

## Requirements

- Node.js 20+
- PostgreSQL 16+ (no pgvector required; embeddings are stored as `float8[]`)
- Redis 7+ recommended for queued document ingestion
- A Gemini API key for chat, embeddings, and RAG

## Environment

Copy `.env.example` to `.env` and set at least:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | JWT signing secret. Production refuses to start if missing. |
| `JWT_EXPIRES_IN` | no | Token lifetime (default `7d`) |
| `REDIS_URL` | recommended | BullMQ document ingestion. If unset, upload falls back to in-process indexing. |
| `GOOGLE_GENAI_API_KEY` | yes for AI | Gemini chat + embeddings |
| `GEMINI_MODEL` | no | Default `gemini-2.0-flash` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Gmail OAuth | Redirect URI must be `{origin}/api/google/auth/callback` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WEBHOOK_BASE_URL` | Twilio | Webhooks under `/api/webhooks/twilio/...` |
| `KNOWLEDGE_STORAGE_DIR` | no | Original uploaded files (default `./storage/knowledge`) |
| `CORS_ORIGINS` | no | Frontend origin (default `http://localhost:5173`) |

Do not commit `.env`.

## Local PostgreSQL

Create an empty database, then apply versioned migrations:

```bash
createdb ai_business_agent
# or: psql -c "CREATE DATABASE ai_business_agent;"
npm run db:migrate
```

See `src/database/drizzle/migrations/README.md` for fresh vs upgrade paths.

Verify:

```bash
node scripts/verify-fresh-db-migration.js
node scripts/verify-phase4-schema.js
```

## Redis

```bash
# Windows/macOS/Linux with Docker:
docker run -d --name aba-redis -p 6379:6379 redis:7
```

Set `REDIS_URL=redis://127.0.0.1:6379`. Without Redis, knowledge uploads still index in-process after a queue enqueue failure.

## Backend

```bash
npm install
npm run start:dev
```

Production:

```bash
npm run build
npm run start:prod
```

`start:prod` runs `node dist/src/main.js` (Nest compiles `src/main.ts` to `dist/src/main.js`).

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend talks to `VITE_API_URL` (see `frontend/.env.example`, default `http://localhost:3000/api`).

## Tests

```bash
npm test
```

Unit tests mock Gemini/Gmail/Twilio. They do not require live credentials.

CI (`npm ci`, schema-source check, `npm run build`, `npm test`) does **not**
migrate PostgreSQL. Generated Drizzle SQL/journal files are local-only and are
not in Git, so a clean clone cannot recreate the database via `db:migrate`.

API smoke / RAG verification (running API + migrated PostgreSQL + Gemini key):

```bash
node scripts/verify-phase5-rag-flow.js
node scripts/verify-conversational-chat.js
```

There is no Playwright suite. Frontend checks are documented in `docs/phase6-frontend-smoke-checklist.md` and `docs/phase7-production-verification.md`.

## Gmail / Twilio

- Gmail OAuth: `GET /api/google/auth` (JWT) starts the flow. The callback is `GET /api/google/auth/callback`. OAuth `state` is a random, single-use, 10-minute value stored in PostgreSQL and bound to the initiating tenant/user.
- Twilio inbound webhooks validate `X-Twilio-Signature` before handling calls/SMS.

## Known limitations

- Chat is not persisted as conversation history (future phase).
- Master Agent routing is regex-based; greetings skip RAG, knowledge questions go to RAG.
- Embeddings use `float8[]` cosine similarity in SQL, not pgvector.
- The live developer database may contain leftover columns/tables (for example `master_setting_entries`) that are unused by current code. Fresh databases created from migrations do not include those leftovers.
- The `tasks` table exists in the TypeScript schema; older developer databases may need the upgrade script before task APIs work.
