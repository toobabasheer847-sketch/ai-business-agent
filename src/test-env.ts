/**
 * Jest setup: provide a deterministic AES-256 key so Nest configuration
 * and encryption unit tests can load without a local .env.
 * Never use this value outside tests.
 */
process.env.INTEGRATION_ENCRYPTION_KEY ??=
  Buffer.alloc(32, 7).toString('base64');
