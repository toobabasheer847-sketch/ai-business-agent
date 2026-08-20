const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const columns = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'knowledge_documents'
       ORDER BY column_name`,
    );

    console.log(
      'knowledge_documents columns:',
      columns.rows.map((row) => row.column_name).join(', '),
    );

    const required = [
      'original_filename',
      'status',
      'failure_reason',
      'byte_size',
    ];
    const present = new Set(columns.rows.map((row) => row.column_name));
    const missing = required.filter((name) => !present.has(name));
    if (missing.length) {
      throw new Error(
        `knowledge_documents missing columns: ${missing.join(', ')}`,
      );
    }

    const extraTables = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('tasks', 'oauth_states', 'knowledge_chunks')
       ORDER BY table_name`,
    );
    console.log(
      'required tables present:',
      extraTables.rows.map((row) => row.table_name).join(', '),
    );
    if (extraTables.rows.length !== 3) {
      throw new Error('Expected tasks, oauth_states, and knowledge_chunks');
    }
  } finally {
    await client.end();
  }

  const migrationsDir = path.join(
    __dirname,
    '../src/database/drizzle/migrations',
  );
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'));
  if (files.length === 0) {
    throw new Error('No SQL migration files found');
  }
  const journal = path.join(migrationsDir, 'meta', '_journal.json');
  if (!fs.existsSync(journal)) {
    throw new Error('Drizzle meta/_journal.json is missing');
  }
  console.log('migration files:', files.join(', '));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
