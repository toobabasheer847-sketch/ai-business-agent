#!/usr/bin/env node
/**
 * Phase 20 live verification: task dependencies + recurring tasks with two tenants.
 *
 * Requires a running API (npm run start:dev) and migrated PostgreSQL with Phase 20 schema.
 *
 *   API_URL=http://localhost:3000/api node scripts/verify-phase20-task-deps-recurrence.js
 */

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
  return { ok: response.ok, status: response.status, body };
}

async function requestOk(path, options = {}) {
  const result = await request(path, options);
  if (!result.ok) {
    throw new Error(
      `${options.method ?? 'GET'} ${path} failed (${result.status}): ${JSON.stringify(result.body)}`,
    );
  }
  return result.body;
}

async function registerTenant(label) {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const auth = await requestOk('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `phase20-${label}-${stamp}@example.com`,
      password: 'Test1234!',
      name: `Phase20 ${label}`,
      tenantName: `Phase20 ${label} Co`,
    }),
  });
  return {
    token: auth.accessToken,
    tenantId: auth.user?.tenantId ?? auth.tenantId,
    userId: auth.user?.id ?? auth.userId,
  };
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function main() {
  console.log(`Phase 20 verification against ${API_URL}`);

  const tenantA = await registerTenant('a');
  const tenantB = await registerTenant('b');

  const createProposal = await requestOk('/ai/task', {
    method: 'POST',
    headers: authHeaders(tenantA.token),
    body: JSON.stringify({ title: 'Create proposal' }),
  });

  const sendProposal = await requestOk('/ai/task', {
    method: 'POST',
    headers: authHeaders(tenantA.token),
    body: JSON.stringify({ title: 'Send proposal' }),
  });

  await requestOk(`/ai/task/${sendProposal.id}/dependencies`, {
    method: 'POST',
    headers: authHeaders(tenantA.token),
    body: JSON.stringify({ dependsOnTaskId: createProposal.id }),
  });

  const deps = await requestOk(`/ai/task/${sendProposal.id}/dependencies`, {
    headers: authHeaders(tenantA.token),
  });
  if (!deps.isBlocked) {
    throw new Error('Expected Send proposal to be blocked');
  }

  const blockedComplete = await request(
    `/ai/task/${sendProposal.id}/complete`,
    {
      method: 'POST',
      headers: authHeaders(tenantA.token),
      body: '{}',
    },
  );
  if (blockedComplete.status !== 400) {
    throw new Error(
      `Expected blocked complete to be 400, got ${blockedComplete.status}`,
    );
  }

  const recurring = await requestOk('/ai/task', {
    method: 'POST',
    headers: authHeaders(tenantA.token),
    body: JSON.stringify({
      title: 'Call client',
      dueAt: new Date().toISOString(),
      recurrenceEnabled: true,
      recurrenceInterval: 'daily',
    }),
  });
  if (!recurring.recurrenceEnabled || !recurring.recurrenceSeriesId) {
    throw new Error('Recurring task was not created with series metadata');
  }

  await requestOk(`/ai/task/${createProposal.id}/complete`, {
    method: 'POST',
    headers: authHeaders(tenantA.token),
    body: '{}',
  });

  const after = await requestOk(`/ai/task/${sendProposal.id}/dependencies`, {
    headers: authHeaders(tenantA.token),
  });
  if (after.isBlocked) {
    throw new Error('Expected Send proposal to unblock after prerequisite completed');
  }

  await requestOk(`/ai/task/${sendProposal.id}/complete`, {
    method: 'POST',
    headers: authHeaders(tenantA.token),
    body: '{}',
  });

  const completedRecurring = await requestOk(`/ai/task/${recurring.id}/complete`, {
    method: 'POST',
    headers: authHeaders(tenantA.token),
    body: '{}',
  });
  if (completedRecurring.status !== 'completed') {
    throw new Error('Recurring task did not complete');
  }

  const listed = await requestOk('/ai/task?search=Call%20client', {
    headers: authHeaders(tenantA.token),
  });
  const nextOccurrence = listed.find(
    (task) =>
      task.id !== recurring.id &&
      task.recurrenceSeriesId === recurring.recurrenceSeriesId &&
      task.status !== 'completed',
  );
  if (!nextOccurrence) {
    throw new Error('Next recurring occurrence was not created');
  }

  const crossGet = await request(
    `/ai/task/${sendProposal.id}/dependencies`,
    { headers: authHeaders(tenantB.token) },
  );
  if (crossGet.status !== 404) {
    throw new Error(
      `Tenant B must not read Tenant A dependencies (got ${crossGet.status})`,
    );
  }

  const crossDep = await request(`/ai/task/${sendProposal.id}/dependencies`, {
    method: 'POST',
    headers: authHeaders(tenantB.token),
    body: JSON.stringify({ dependsOnTaskId: createProposal.id }),
  });
  if (![403, 404].includes(crossDep.status)) {
    throw new Error(
      `Tenant B must not create Tenant A dependencies (got ${crossDep.status})`,
    );
  }

  const crossRecurrence = await request(`/ai/task/${recurring.id}`, {
    method: 'POST',
    headers: authHeaders(tenantB.token),
    body: JSON.stringify({ recurrenceEnabled: false }),
  });
  if (crossRecurrence.status !== 404) {
    throw new Error(
      `Tenant B must not modify Tenant A recurrence (got ${crossRecurrence.status})`,
    );
  }

  console.log('Phase 20 verification passed.');
  console.log(
    JSON.stringify(
      {
        tenantA: tenantA.tenantId,
        tenantB: tenantB.tenantId,
        dependencyUnblocked: true,
        nextOccurrenceId: nextOccurrence.id,
        crossTenantDenied: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('Phase 20 verification failed:', error.message || error);
  process.exit(1);
});
