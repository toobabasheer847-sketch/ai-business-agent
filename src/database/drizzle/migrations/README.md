# Drizzle migrations

This directory contains versioned SQL migrations generated from
`src/database/drizzle/schema/` via `npm run db:generate`.

Generated SQL, `meta/_journal.json`, and snapshot files are **local-only**.
Do not commit or push them. The TypeScript schema under
`src/database/drizzle/schema/` is the source of truth in Git.

Do not hand-write replacement SQL for the baseline. Review generated files
before using them locally.

## Files

| File | Purpose |
|------|---------|
| `0000_calm_magma.sql` | Full baseline: all current tables, enums, FKs, and indexes |
| `meta/_journal.json` | Drizzle migration journal (required by `drizzle-kit migrate`) |
| `meta/0000_snapshot.json` | Schema snapshot used for later `db:generate` diffs |

PostgreSQL extensions such as pgvector are **not** required. Chunk embeddings
are `double precision[]` (`float8[]`).

## Fresh database

```bash
# DATABASE_URL must point at an empty database
npm run db:migrate
node scripts/verify-fresh-db-migration.js
```

This applies `0000_calm_magma.sql` in order: enums, tables, foreign keys, indexes.

## Existing database (Phase 1–6 already applied)

Do **not** drop the database. `0000_calm_magma.sql` uses `CREATE TABLE` / `CREATE TYPE`
without `IF NOT EXISTS`, so `npm run db:migrate` will fail on databases that already
have `tenants`, `proposal_status`, etc.

Use the upgrade script instead. It only adds objects that are missing
(`tasks`, `oauth_states`, related enums/indexes) and records the baseline
migration hash so later `db:migrate` runs are no-ops:

```bash
node scripts/upgrade-existing-db.js
```

The script does not drop leftover columns or tables from older schemas
(for example `master_setting_entries` or extra `knowledge_documents` columns).

## Regenerating migrations

After changing files under `src/database/drizzle/schema/`:

```bash
npm run db:generate
```

Review the generated SQL and snapshot locally. Do not commit them.
