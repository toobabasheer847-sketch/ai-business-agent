#!/usr/bin/env node
require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const gmail = await c.query(`
    SELECT
      id,
      (access_token IS NOT NULL AND access_token LIKE 'enc:v1:%') AS access_encrypted,
      (refresh_token IS NOT NULL AND refresh_token LIKE 'enc:v1:%') AS refresh_encrypted,
      (client_secret IS NULL OR client_secret LIKE 'enc:v1:%') AS client_secret_ok,
      (smtp_password IS NULL OR smtp_password LIKE 'enc:v1:%') AS smtp_ok
    FROM gmail_configs
  `);
  const phone = await c.query(`
    SELECT
      id,
      (auth_token LIKE 'enc:v1:%') AS auth_encrypted
    FROM phone_numbers
    WHERE auth_token IS NOT NULL
  `);
  console.log(
    JSON.stringify(
      {
        gmailRows: gmail.rows.length,
        gmailAllEncrypted: gmail.rows.every(
          (r) =>
            r.access_encrypted &&
            r.refresh_encrypted &&
            r.client_secret_ok &&
            r.smtp_ok,
        ),
        phoneAllEncrypted: phone.rows.every((r) => r.auth_encrypted),
        gmail: gmail.rows.map((r) => ({
          id: r.id,
          accessEncrypted: r.access_encrypted,
          refreshEncrypted: r.refresh_encrypted,
          clientSecretOk: r.client_secret_ok,
          smtpOk: r.smtp_ok,
        })),
        phone: phone.rows.map((r) => ({
          id: r.id,
          authEncrypted: r.auth_encrypted,
        })),
      },
      null,
      2,
    ),
  );
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
