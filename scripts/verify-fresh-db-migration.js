const { Client } = require('pg');
const { execSync } = require('node:child_process');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function toAdminUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  url.pathname = '/postgres';
  return url.toString();
}

function toTestUrl(databaseUrl, testDb) {
  const url = new URL(databaseUrl);
  url.pathname = `/${testDb}`;
  return url.toString();
}

const EXPECTED_TABLES = [
  'tenants',
  'users',
  'knowledgebases',
  'knowledge_documents',
  'knowledge_chunks',
  'tasks',
  'oauth_states',
  'gmail_configs',
  'phone_numbers',
  'conversations',
  'messages',
  'proposals',
];

async function main() {
  const sourceUrl = process.env.DATABASE_URL;
  if (!sourceUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const adminUrl = process.env.DATABASE_ADMIN_URL || toAdminUrl(sourceUrl);
  const testDb = `ai_business_agent_phase7_${Date.now()}`;

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${testDb}"`);
  await admin.end();

  const testUrl = toTestUrl(sourceUrl, testDb);
  console.log(`Created fresh database: ${testDb}`);

  try {
    execSync('npx drizzle-kit migrate', {
      env: { ...process.env, DATABASE_URL: testUrl },
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
  } catch (error) {
    throw new Error(`db:migrate failed: ${error.message}`);
  }

  const verify = new Client({ connectionString: testUrl });
  await verify.connect();
  try {
    const tables = await verify.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [EXPECTED_TABLES],
    );
    const found = tables.rows.map((row) => row.table_name);
    const missing = EXPECTED_TABLES.filter((name) => !found.includes(name));
    if (missing.length) {
      throw new Error(`Missing tables: ${missing.join(', ')}`);
    }

    const columns = await verify.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'knowledge_documents'
         AND column_name IN ('original_filename', 'status', 'failure_reason', 'byte_size')
       ORDER BY column_name`,
    );
    if (columns.rows.length !== 4) {
      throw new Error('knowledge_documents is missing Phase 4 columns');
    }

    const embedding = await verify.query(
      `SELECT udt_name FROM information_schema.columns
       WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'`,
    );
    if (embedding.rows[0]?.udt_name !== '_float8') {
      throw new Error(
        `knowledge_chunks.embedding expected _float8, got ${embedding.rows[0]?.udt_name}`,
      );
    }

    const enums = await verify.query(
      `SELECT t.typname FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE t.typtype = 'e' AND n.nspname = 'public'
       ORDER BY t.typname`,
    );
    const enumNames = enums.rows.map((row) => row.typname);
    for (const required of ['proposal_status', 'task_status', 'task_priority']) {
      if (!enumNames.includes(required)) {
        throw new Error(`Missing enum: ${required}`);
      }
    }

    console.log('tables:', found.join(', '));
    console.log(
      'phase4 columns:',
      columns.rows.map((row) => row.column_name).join(', '),
    );
    console.log('enums:', enumNames.join(', '));
  } finally {
    await verify.end();
  }

  const cleanup = new Client({ connectionString: adminUrl });
  await cleanup.connect();
  await cleanup.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
    [testDb],
  );
  await cleanup.query(`DROP DATABASE "${testDb}"`);
  await cleanup.end();

  console.log('Fresh database migration verification: PASS');
}

main().catch((error) => {
  console.error('Fresh database migration verification: FAIL');
  console.error(error.message);
  process.exit(1);
});
