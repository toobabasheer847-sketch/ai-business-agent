# Frontend manual smoke checklist (Phase 6)

There is no Playwright or frontend test runner configured. Use this checklist after backend + frontend are running locally.

## Prerequisites

- Backend: `npm run build && node dist/src/main.js` (port 3000)
- Frontend: `cd frontend && npm run dev` (port 5173)
- PostgreSQL migrated (`npm run db:migrate`)
- Redis running if async document ingestion is required
- `.env` populated with `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_GENAI_API_KEY`

## Checklist

| # | Step | Expected |
|---|------|----------|
| 1 | Open app, register or log in | Dashboard loads, JWT stored |
| 2 | Navigate to Knowledge Bases | List/create page loads |
| 3 | Create a knowledge base | KB appears in list |
| 4 | Upload a `.txt` document | Document row shows `pending` → `processing` → `indexed` |
| 5 | Open AI Assistant (`/assistant`) | Chat UI loads |
| 6 | Send `hello` | Conversational reply, no KB document content |
| 7 | Ask a question matching uploaded content | Grounded answer with sources |
| 8 | Ask unrelated question (e.g. food recipe) | No-knowledge response, no sources |
| 9 | Verify sources panel | Document title/filename shown for RAG answers |
| 10 | Log in as second tenant, repeat KB upload | Tenant A data not visible to Tenant B |

Record PASS/FAIL for each step when completing Phase 6 regression.
