#!/usr/bin/env node
/**
 * Add schema objects that exist in 0000_calm_magma.sql but may be missing
 * from a Phase 1–6 developer/production database.
 *
 * Safe: CREATE IF NOT EXISTS / duplicate_object handlers only.
 * Does not drop leftover tables or columns.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/upgrade-existing-db.js
 */
require('dotenv').config();
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const MIGRATION_TAG = '0000_calm_magma';
const SQL_PATH = path.join(
  __dirname,
  '..',
  'src',
  'database',
  'drizzle',
  'migrations',
  `${MIGRATION_TAG}.sql`,
);

function drizzleHash(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = fs.readFileSync(SQL_PATH, 'utf8');
  const hash = drizzleHash(sql);

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."task_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "tasks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "created_by" uuid NOT NULL,
        "assigned_to" uuid,
        "title" varchar(255) NOT NULL,
        "description" text,
        "status" "task_status" DEFAULT 'pending' NOT NULL,
        "priority" "task_priority" DEFAULT 'medium' NOT NULL,
        "due_at" timestamp with time zone,
        "completed_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "oauth_states" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "state" varchar(128) NOT NULL,
        "tenant_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "purpose" varchar(64) DEFAULT 'gmail_oauth' NOT NULL,
        "expires_at" timestamp with time zone NOT NULL,
        "used_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "oauth_states_state_unique" UNIQUE("state")
      );
    `);

    await client.query(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "company_id" uuid`,
    );
    await client.query(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "prospect_id" uuid`,
    );
    await client.query(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "lead_id" uuid`,
    );

    const constraints = [
      `ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE cascade`,
      `ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade`,
      `ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade`,
      `ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE cascade`,
      `ALTER TABLE "tasks" ADD CONSTRAINT "tasks_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE cascade`,
      `ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE cascade`,
      `ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE cascade`,
      `ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade`,
    ];

    for (const statement of constraints) {
      await client.query(`
        DO $$ BEGIN
          ${statement};
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }

    await client.query(
      `CREATE INDEX IF NOT EXISTS "tasks_tenant_id_idx" ON "tasks" USING btree ("tenant_id")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "tasks_assigned_to_idx" ON "tasks" USING btree ("assigned_to")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" USING btree ("status")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "tasks_due_at_idx" ON "tasks" USING btree ("due_at")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "tasks_tenant_status_idx" ON "tasks" USING btree ("tenant_id","status")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "tasks_company_id_idx" ON "tasks" USING btree ("company_id")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "tasks_prospect_id_idx" ON "tasks" USING btree ("prospect_id")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "tasks_lead_id_idx" ON "tasks" USING btree ("lead_id")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "oauth_states_state_idx" ON "oauth_states" USING btree ("state")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "oauth_states_expires_at_idx" ON "oauth_states" USING btree ("expires_at")`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "phone_numbers_tenant_id_idx" ON "phone_numbers" USING btree ("tenant_id")`,
    );

    await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const existing = await client.query(
      `SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1 LIMIT 1`,
      [hash],
    );
    if (existing.rowCount === 0) {
      await client.query(
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
        [hash, Date.now()],
      );
    }

    await client.query('COMMIT');
    console.log('Existing database upgrade: PASS');
    console.log(`Stamped drizzle migration hash for ${MIGRATION_TAG}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Existing database upgrade: FAIL');
  console.error(error.message);
  process.exit(1);
});
