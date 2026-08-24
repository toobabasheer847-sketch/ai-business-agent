# Phase 6 placeholder file audit

These files under `src/ai/tools/` and `src/ai/agents/` appear to be scaffolds or legacy placeholders. **None were deleted** in Phase 6 because runtime import analysis did not prove them unused in all contexts.

## `src/ai/tools/` (10 files)

| File | Runtime imports | Tests | Verdict |
|------|-----------------|-------|---------|
| `mail/mail-list.tool.ts` | None found | None | Legacy placeholder — keep |
| `mail/mail-send.tool.ts` | None found | None | Legacy placeholder — keep |
| `mail/mail-draft.tool.ts` | None found | None | Legacy placeholder — keep |
| `rag/company-info.tool.ts` | None found | None | Legacy placeholder — keep |
| `rag/knowledge-reader.tool.ts` | None found | None | Legacy placeholder — keep |
| `rag/vectorize.tool.ts` | None found | None | Legacy placeholder — keep |
| `proposal/*.tool.ts` (4 files) | None found | None | Legacy placeholder — keep |

Active RAG implementation lives in `src/ai/agents/rag/rag.tools.ts`.

## `src/ai/agents/master/`

| File | Status |
|------|--------|
| `master.agent.ts` | **Active** — routing, chat/RAG delegation |
| `master-agent.ts` | Stub/legacy naming duplicate — not imported; keep until Phase 7 cleanup |

## `src/ai/agents/team/`

Team agent scaffolds are unimplemented. No imports from production modules. Keep for future phases.

## Recommendation

Do not delete without a dedicated cleanup phase that also removes ADK registry references and updates documentation.
