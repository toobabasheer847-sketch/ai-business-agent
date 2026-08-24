#!/usr/bin/env node
/**
 * One-time migration: encrypt legacy plaintext Gmail/Twilio secrets in Postgres.
 *
 * Prerequisites:
 *   DATABASE_URL
 *   INTEGRATION_ENCRYPTION_KEY  (base64 or hex 32-byte AES-256 key)
 *
 * Usage (from repo root, with .env loaded by dotenv):
 *   node scripts/encrypt-integration-secrets.js
 *
 * Safe to re-run: already-encrypted (enc:v1:) values are skipped.
 * Never logs secret values.
 */

const { createRequire } = require('module');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const requireFromRoot = createRequire(path.join(root, 'package.json'));
requireFromRoot('dotenv').config({ path: path.join(root, '.env') });
const { Client } = requireFromRoot('pg');

const PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function resolveKey(raw) {
  const value = raw?.trim();
  if (!value) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY is not configured');
  }
  let key;
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    key = Buffer.from(value, 'hex');
  } else {
    key = Buffer.from(value, 'base64');
  }
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      'INTEGRATION_ENCRYPTION_KEY must decode to exactly 32 bytes',
    );
  }
  return key;
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function encrypt(plaintext, key) {
  if (plaintext == null || plaintext === '' || isEncrypted(plaintext)) {
    return plaintext;
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, authTag, encrypted]).toString('base64')}`;
}

async function migrateGmail(client, key) {
  const { rows } = await client.query(
    `SELECT id, client_secret, access_token, refresh_token, smtp_password
     FROM gmail_configs`,
  );

  let updated = 0;
  for (const row of rows) {
    const patch = {};
    for (const [col, prop] of [
      ['client_secret', 'client_secret'],
      ['access_token', 'access_token'],
      ['refresh_token', 'refresh_token'],
      ['smtp_password', 'smtp_password'],
    ]) {
      const value = row[prop];
      if (value && !isEncrypted(value)) {
        patch[col] = encrypt(value, key);
      }
    }
    const cols = Object.keys(patch);
    if (!cols.length) continue;

    const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
    await client.query(
      `UPDATE gmail_configs SET ${sets}, updated_at = NOW() WHERE id = $1`,
      [row.id, ...cols.map((c) => patch[c])],
    );
    updated += 1;
  }
  return { scanned: rows.length, updated };
}

async function migrateTwilio(client, key) {
  const { rows } = await client.query(
    `SELECT id, auth_token FROM phone_numbers WHERE auth_token IS NOT NULL`,
  );

  let updated = 0;
  for (const row of rows) {
    if (!row.auth_token || isEncrypted(row.auth_token)) continue;
    await client.query(
      `UPDATE phone_numbers SET auth_token = $2, updated_at = NOW() WHERE id = $1`,
      [row.id, encrypt(row.auth_token, key)],
    );
    updated += 1;
  }
  return { scanned: rows.length, updated };
}

async function main() {
  const key = resolveKey(process.env.INTEGRATION_ENCRYPTION_KEY);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query('BEGIN');
    const gmail = await migrateGmail(client, key);
    const twilio = await migrateTwilio(client, key);
    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          ok: true,
          gmailConfigs: gmail,
          phoneNumbers: twilio,
          note: 'Secret values were not printed.',
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
