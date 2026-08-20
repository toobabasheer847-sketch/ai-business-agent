#!/usr/bin/env node
const API_URL = process.env.API_URL ?? 'http://localhost:3000/api';

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

async function chat(token, message) {
  return request('/ai/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });
}

async function waitForIndexed(token, knowledgeBaseId, documentId) {
  const started = Date.now();

  while (Date.now() - started < 120000) {
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

async function main() {
  const email = `conv-test-${Date.now()}@example.com`;
  const auth = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'Test1234!',
      name: 'Conv Tester',
      tenantName: 'Conv Co',
    }),
  });

  const token = auth.accessToken;
  const kb = await request('/knowledgebases', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Profile KB', description: 'test' }),
  });

  const content =
    'Tooba Basheer is a software engineer. Skills: TypeScript, React, Node.js, PostgreSQL. Experience: 5 years building business applications. Projects: AI Business Agent platform, CRM integrations.';
  const form = new FormData();
  form.append(
    'file',
    new Blob([content], { type: 'text/plain' }),
    'tooba-profile.txt',
  );

  const uploadResponse = await fetch(
    `${API_URL}/knowledgebases/${kb.id}/documents`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );
  const upload = await uploadResponse.json();
  if (!uploadResponse.ok) {
    throw new Error(JSON.stringify(upload));
  }

  await waitForIndexed(token, kb.id, upload.id);

  const tests = [
    ['A', 'hello'],
    ['B', "What are Tooba Basheer's skills according to the uploaded document?"],
    ['C', "What is Tooba Basheer's favorite food?"],
    ['D', 'How are you?'],
  ];

  const results = {};

  for (const [label, message] of tests) {
    const result = await chat(token, message);
    console.log(`\n--- Test ${label}: ${message} ---`);
    console.log(JSON.stringify(result, null, 2));

    results[label] = {
      delegation: result.delegation,
      usedKnowledge: result.usedKnowledge,
      sourceCount: result.sources?.length ?? 0,
      response: result.response,
    };
  }

  const forbidden =
    /knowledge base|uploaded document|provided context|profile|skills|experience|projects|tooba basheer/i;

  results.summary = {
    A: {
      pass:
        results.A.delegation === 'chat' &&
        !forbidden.test(results.A.response),
    },
    B: {
      pass:
        results.B.delegation === 'rag' &&
        results.B.usedKnowledge === true &&
        (results.B.sourceCount ?? 0) > 0,
    },
    C: {
      pass:
        results.C.delegation === 'rag' &&
        results.C.usedKnowledge === false &&
        results.C.sourceCount === 0,
    },
    D: {
      pass:
        results.D.delegation === 'chat' &&
        !forbidden.test(results.D.response),
    },
  };

  console.log('\nManual test summary:\n', JSON.stringify(results.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
