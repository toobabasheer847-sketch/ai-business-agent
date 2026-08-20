const { Client } = require('pg');
const path = require('node:path');

async function main() {
  const adminUrl =
    process.env.DATABASE_ADMIN_URL ||
    'postgresql://postgres:12345@localhost:5432/postgres';
  const testDb = `ai_business_agent_phase6_${Date.now()}`;

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${testDb}"`);
  await admin.end();

  const testUrl = adminUrl.replace(/\/[^/]+$/, `/${testDb}`);
  console.log(`Created fresh database: ${testDb}`);

  const { execSync } = require('node:child_process');
  try {
    execSync('npx drizzle-kit migrate', {
      env: { ...process.env, DATABASE_URL: testUrl },
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } catch (error) {
    const stdout = error.stdout?.toString?.() ?? '';
    const stderr = error.stderr?.toString?.() ?? '';
    console.log(stdout);
    console.error(stderr);
    throw new Error(`db:migrate failed: ${stderr || stdout || error.message}`);
  }

  const verify = new Client({ connectionString: testUrl });
  await verify.connect();
  const tables = await verify.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('knowledge_documents', 'knowledge_chunks', 'knowledgebases')
     ORDER BY table_name`,
  );
  const columns = await verify.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'knowledge_documents'
       AND column_name IN ('original_filename', 'status', 'failure_reason', 'byte_size')
     ORDER BY column_name`,
  );

  console.log('tables:', tables.rows.map((row) => row.table_name).join(', '));
  console.log(
    'phase4 columns:',
    columns.rows.map((row) => row.column_name).join(', '),
  );

  await verify.end();

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
