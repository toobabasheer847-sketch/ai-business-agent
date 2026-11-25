#!/usr/bin/env node
/**
 * Confirms migration 0010 objects exist. Does not print the database URL.
 * Applies scripts/upgrade-existing-db.js only when PHASE40_APPLY=1.
 */
require('dotenv').config();
const { Client } = require('pg');

const tables = [
  'business_performance_deviations',
  'business_bottlenecks',
  'improvement_outcome_evaluations',
  'business_improvement_reviews',
  'business_improvement_events',
];
const columns = ['plan_kind', 'related_goal_id', 'related_recommendation_id', 'evidence', 'review_schedule', 'next_review_at'];

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
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'strategic_plans' AND column_name = ANY($1::text[])
       ORDER BY 1`,
      [columns],
    );
    console.log('TABLES', present.join(',') || 'NONE');
    console.log('MISSING_TABLES', tables.filter((name) => !present.includes(name)).join(',') || 'NONE');
    console.log('PLAN_COLS', cols.rows.map((row) => row.column_name).join(',') || 'NONE');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.log('DB_ERROR', error.code || error.message);
  process.exitCode = 1;
});
