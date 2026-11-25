#!/usr/bin/env node
/** Confirms migration 0011 objects exist. Does not print the database URL. */
require('dotenv').config();
const { Client } = require('pg');

const tables = ['customer_ai_settings', 'customer_chat_sessions', 'customer_ai_states'];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('NO_DATABASE_URL');
    return;
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const found = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])
       ORDER BY 1`,
      [tables],
    );
    const present = found.rows.map((row) => row.table_name);
    const trigger = await client.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'workflows_trigger_check'`,
    );
    const column = await client.query(
      `SELECT data_type, character_maximum_length FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'customer_chat_sessions' AND column_name = 'token_hash'`,
    );
    const definition = trigger.rows[0]?.def ?? '';
    console.log('TABLES', present.join(',') || 'NONE');
    console.log('MISSING', tables.filter((name) => !present.includes(name)).join(',') || 'NONE');
    console.log('HANDOFF_TRIGGER', definition.includes('customer_handoff') ? 'yes' : 'no');
    console.log('TOKEN_HASH', column.rows[0] ? `${column.rows[0].data_type}:${column.rows[0].character_maximum_length}` : 'missing');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('CHECK_FAIL', error.message);
  process.exit(1);
});
