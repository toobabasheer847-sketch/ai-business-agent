# AI Business Agent

Multi-tenant NestJS backend and React frontend for knowledge-base RAG, Gmail/Twilio communication, CRM-style tenant data, and a JWT-scoped AI Assistant.

## Requirements

- Node.js 20+
- PostgreSQL 16+ (no pgvector required; embeddings are stored as `float8[]`)
- Redis 7+ recommended for queued document ingestion and task reminders
- A Gemini API key for chat, embeddings, and RAG (optional for non-AI boot; RAG/chat degrade gracefully when unset)

## Environment

Copy `.env.example` to `.env` and set at least:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | JWT signing secret. Production refuses to start if missing. |
| `INTEGRATION_ENCRYPTION_KEY` | yes | AES-256 key (base64 or hex, 32 bytes) for Gmail/Twilio secrets at rest. Generate with `openssl rand -base64 32`. Never commit the real value. |
| `JWT_EXPIRES_IN` | no | Token lifetime (default `7d`) |
| `REDIS_URL` | recommended | BullMQ document ingestion + task reminders |
| `GOOGLE_GENAI_API_KEY` | for AI | Gemini chat + embeddings. Without it the app boots; RAG routes are disabled. |
| `GEMINI_MODEL` | no | Default fallback model (e.g. `gemini-2.0-flash`). Tenants may override via Master Settings allowlist. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Gmail OAuth | Redirect URI must be `{origin}/api/google/auth/callback` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WEBHOOK_BASE_URL` | Twilio | Env-level Twilio; per-tenant `authToken` is stored encrypted on `phone_numbers` |
| `KNOWLEDGE_STORAGE_DIR` | no | Original uploaded files (default `./storage/knowledge`) |
| `CORS_ORIGINS` | no | Frontend origin (default `http://localhost:5173`) |

Do not commit `.env` or real encryption keys.

### Integration secrets at rest

Gmail `accessToken`, `refreshToken`, `clientSecret`, `smtpPassword` and Twilio `authToken` are encrypted with AES-256-GCM before write and decrypted only inside integration services at point of use. Values never appear in API responses or AI tool outputs.

Encrypt existing plaintext rows once:

```bash
npm run db:encrypt-secrets
```

Safe to re-run; already-encrypted (`enc:v1:`) values are skipped.

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

## AI Assistant & security architecture

- Chat is persisted: `POST /api/ai/chat` creates/reuses assistant conversations and messages (Phase 8).
- JWT `tenantId` / `userId` are authoritative. ADK tools use `getTrustedAiContext()` — model-supplied tenant IDs are ignored.
- Master Agent routes by regex, then delegates to Task (deterministic), RAG (ADK + fallback), Communication, or Proposal subagents.
- Per-tenant `master_settings.aiModel` is allowlisted and resolved at runtime (`resolveAdkModelName` → `AdkAgentFactoryService`).

## Tests

```bash
npm test
```

Unit tests mock Gemini/Gmail/Twilio. They do not require live credentials.

CI (`npm ci`, schema-source check, `npm run build`, `npm test`) does **not**
migrate PostgreSQL. Generated Drizzle SQL/journal files are local-only and are
not in Git, so a clean clone cannot recreate the database via `db:migrate`.

API smoke / RAG / multi-tenant verification (running API + migrated PostgreSQL):

```bash
node scripts/verify-phase5-rag-flow.js
node scripts/verify-conversational-chat.js
node scripts/verify-phase19-tenant-isolation.js
```

There is no Playwright suite. Frontend checks are documented in `docs/phase6-frontend-smoke-checklist.md` and `docs/phase7-production-verification.md`.

## Gmail / Twilio

- Gmail OAuth: `GET /api/google/auth` (JWT) starts the flow. The callback is `GET /api/google/auth/callback`. OAuth `state` is a random, single-use, 10-minute value stored in PostgreSQL and bound to the initiating tenant/user.
- Proposal status `sent` delivers via the authenticated tenant’s Gmail (`ProposalDeliveryService`) using decrypted credentials in memory only.
- Twilio inbound webhooks validate `X-Twilio-Signature` before handling calls/SMS.
- Per-tenant Twilio `authToken` on `phone_numbers` is encrypted at rest.

## Known limitations

- Master Agent routing is regex-based; greetings skip RAG, knowledge questions go to RAG.
- Embeddings use `float8[]` cosine similarity in SQL, not pgvector.
- The live developer database may contain leftover columns/tables (for example `master_setting_entries`) that are unused by current code. Fresh databases created from migrations do not include those leftovers.
- The `tasks` table exists in the TypeScript schema; older developer databases may need the upgrade script before task APIs work.
- Task dependencies and recurring tasks are supported (Phase 20):
  - Dependencies live in `task_dependencies` (tenant-scoped; cycles/self/cross-tenant rejected).
  - Blocking is computed (no new status): incomplete prerequisites keep a task blocked for completion/reminders.
  - Recurrence (`daily` / `weekly` / `monthly`) spawns the next occurrence on complete with idempotent series keys.
  - **Intentional:** the next recurring occurrence does **not** copy dependency edges from the completed occurrence. Dependencies are per-task links; re-link prerequisites on the new occurrence when needed.
- Frontend automated tests are not present yet.

### Task reliability smoke (Phase 21)

```bash
node scripts/upgrade-existing-db.js
node scripts/verify-phase20-task-deps-recurrence.js
node scripts/verify-phase21-task-reliability.js
```

Activity events recorded for Phase 20/21 actions (when activity/audit is available):

- `TASK_DEPENDENCY_ADDED` / `TASK_DEPENDENCY_REMOVED`
- `TASK_RECURRENCE_ENABLED` / `TASK_RECURRENCE_DISABLED` / `TASK_RECURRENCE_SPAWNED`
- `TASK_BLOCKED_COMPLETION_REJECTED`

### Task dependencies & recurrence API

```http
POST   /api/ai/task/:taskId/dependencies
{ "dependsOnTaskId": "<uuid>" }

GET    /api/ai/task/:taskId/dependencies
DELETE /api/ai/task/:taskId/dependencies/:dependsOnTaskId

POST   /api/ai/task
{ "title": "Call client", "dueAt": "...", "recurrenceEnabled": true, "recurrenceInterval": "weekly" }
```

Natural language examples (JWT tenant/user remain authoritative):

- `Make Send proposal depend on Create proposal.`
- `Which tasks are blocked?`
- `Create a task to call client every Monday.`

Upgrade existing databases:

```bash
node scripts/upgrade-existing-db.js
```

Two-tenant smoke (API + DB):

```bash
node scripts/verify-phase20-task-deps-recurrence.js
```

Rollback considerations: drop `task_dependencies` and recurrence columns only after confirming no production series rely on them; do not rewrite baseline migrations.
