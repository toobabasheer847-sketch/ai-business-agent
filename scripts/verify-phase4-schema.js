const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://postgres:12345@localhost:5432/ai_business_agent';

  const client = new Client({ connectionString });
  await client.connect();

  const columns = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'knowledge_documents'
     ORDER BY column_name`,
  );

  console.log(
    'knowledge_documents columns:',
    columns.rows.map((row) => row.column_name).join(', '),
  );

  const migrationsDir = path.join(
    __dirname,
    '../src/database/drizzle/migrations',
  );
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'));
  console.log('migration files:', files.join(', '));

  await client.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
