#!/usr/bin/env node
/**
 * Phase 5 RAG verification utility.
 *
 * Usage:
 *   API_URL=http://localhost:3000/api \
 *   DATABASE_URL=postgresql://... \
 *   node scripts/verify-phase5-rag-flow.js
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3000/api';
const DATABASE_URL = process.env.DATABASE_URL;

function log(step, message) {
  console.log(`[${step}] ${message}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  const text = await response.text();
  let body;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(
      `${options.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(body)}`,
    );
  }

  return body;
}

async function registerTenant(label) {
  const email = `${label}-${Date.now()}@example.com`;
  const password = 'VerifyPhase5!123';

  const auth = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      name: `${label} Verifier`,
      tenantName: `${label} Co`,
    }),
  });

  return {
    token: auth.accessToken,
    tenantId: auth.user?.tenantId,
    email,
  };
}

async function createKnowledgeBase(token, name) {
  return request('/knowledgebases', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, description: 'Phase 5 verification KB' }),
  });
}

async function uploadPdf(token, knowledgeBaseId, fileBuffer, filename) {
  const mimeType = filename.endsWith('.pdf')
    ? 'application/pdf'
    : 'text/plain';
  const form = new FormData();
  form.append(
    'file',
    new Blob([fileBuffer], { type: mimeType }),
    filename,
  );

  const response = await fetch(
    `${API_URL}/knowledgebases/${knowledgeBaseId}/documents`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    },
  );

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status}): ${JSON.stringify(body)}`);
  }

  return body;
}

async function waitForIndexed(token, knowledgeBaseId, documentId, timeoutMs = 120000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const documents = await request(
      `/knowledgebases/${knowledgeBaseId}/documents`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const document = documents.find((item) => item.id === documentId);
    if (document?.status === 'indexed') {
      return document;
    }

    if (document?.status === 'failed') {
      throw new Error(
        `Document ingestion failed: ${document.failureReason ?? 'unknown error'}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error('Timed out waiting for document to reach indexed status');
}

async function ragQuery(token, query) {
  return request('/ai/rag/query', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
}

async function chatQuery(token, message) {
  return request('/ai/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });
}

async function countChunksForTenant(tenantId) {
  if (!DATABASE_URL) {
    return null;
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const result = await client.query(
      'SELECT COUNT(*)::int AS count FROM knowledge_chunks WHERE tenant_id = $1',
      [tenantId],
    );
    return result.rows[0]?.count ?? 0;
  } finally {
    await client.end();
  }
}

async function main() {
  const tenantAPdfBuffer = Buffer.from(
    'Dummy PDF file for Phase 5 verification. This document describes the company refund policy and product overview.',
    'utf8',
  );

  log('1', 'Register tenant A');
  const tenantA = await registerTenant('tenant-a');

  log('2', 'Create knowledge base and upload document for tenant A');
  const kbA = await createKnowledgeBase(tenantA.token, 'Phase 5 KB A');
  const uploadA = await uploadPdf(
    tenantA.token,
    kbA.id,
    tenantAPdfBuffer,
    'phase5-sample-a.txt',
  );
  await waitForIndexed(tenantA.token, kbA.id, uploadA.id);

  log('3', 'Register tenant B');
  const tenantB = await registerTenant('tenant-b');
  const kbB = await createKnowledgeBase(tenantB.token, 'Phase 5 KB B');
  const uploadB = await uploadPdf(
    tenantB.token,
    kbB.id,
    Buffer.from('Tenant B secret content about lunar colonies.'),
    'tenant-b-secret.txt',
  );
  await waitForIndexed(tenantB.token, kbB.id, uploadB.id);

  if (DATABASE_URL) {
    const chunksA = await countChunksForTenant(tenantA.tenantId);
    const chunksB = await countChunksForTenant(tenantB.tenantId);
    log('4', `Chunk counts — tenant A: ${chunksA}, tenant B: ${chunksB}`);
  } else {
    log('4', 'DATABASE_URL not set; skipping direct chunk count verification');
  }

  log('5', 'Relevant RAG query');
  const relevant = await ragQuery(
    tenantA.token,
    'What information is contained in the uploaded document?',
  );
  console.log(JSON.stringify(relevant, null, 2));

  log('6', 'Unknown RAG query');
  const unknown = await ragQuery(
    tenantA.token,
    'What is the secret lunar colony password?',
  );
  console.log(JSON.stringify(unknown, null, 2));

  log('7', 'Tenant isolation query from tenant A');
  const isolation = await ragQuery(
    tenantA.token,
    'Tell me about lunar colonies',
  );
  console.log(JSON.stringify(isolation, null, 2));

  log('8', 'Chat → RAG integration');
  const chat = await chatQuery(
    tenantA.token,
    'What information is contained in the uploaded document?',
  );
  console.log(JSON.stringify(chat, null, 2));

  const summary = {
    relevantQuestion: {
      pass: relevant.usedKnowledge === true && (relevant.sources?.length ?? 0) > 0,
      usedKnowledge: relevant.usedKnowledge,
      sourceCount: relevant.sources?.length ?? 0,
    },
    unknownQuestion: {
      pass: unknown.usedKnowledge === false,
      usedKnowledge: unknown.usedKnowledge,
    },
    tenantIsolation: {
      pass:
        isolation.usedKnowledge === false ||
        !JSON.stringify(isolation).includes('Tenant B secret content'),
      usedKnowledge: isolation.usedKnowledge,
    },
    chatToRag: {
      pass:
        chat.delegation === 'rag' &&
        typeof chat.response === 'string' &&
        chat.response.length > 0,
      delegation: chat.delegation,
      usedKnowledge: chat.usedKnowledge,
      sourceCount: chat.sources?.length ?? 0,
    },
  };

  console.log('\nVerification summary:\n', JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
