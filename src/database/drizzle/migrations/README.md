# Drizzle migrations

This directory contains versioned SQL migrations for the PostgreSQL schema.

## Fresh database

```bash
# Ensure DATABASE_URL is set (see .env.example)
npm run db:migrate
```

This applies:

1. `0000_initial_schema.sql` — full baseline schema (all tables, indexes, FKs)
2. `0001_knowledge_document_ingestion.sql` — idempotent Phase 4 upgrade (no-op on fresh DBs)

## Existing database (pre-Phase 4)

If your database was created manually or from an older notebook migration **before** Phase 4 knowledge ingestion:

1. **Do not** drop or recreate the database.
2. If tables already exist but `0000_initial_schema` was never applied, mark it as applied without running it:

   ```sql
   CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
     id SERIAL PRIMARY KEY,
     hash text NOT NULL,
     created_at bigint
   );
   INSERT INTO "__drizzle_migrations" (hash, created_at)
   VALUES ('0000_initial_schema', extract(epoch from now()) * 1000);
   ```

3. Run `npm run db:migrate` to apply `0001_knowledge_document_ingestion.sql`.

Alternatively, apply `0001_knowledge_document_ingestion.sql` directly with `psql` — all statements use `IF NOT EXISTS` / `DROP NOT NULL` and are safe to re-run.

## Regenerating migrations

After changing Drizzle schema files under `src/database/drizzle/schema/`:

```bash
npm run db:generate
```

Review the generated SQL before committing. Do not blindly recreate production databases.
