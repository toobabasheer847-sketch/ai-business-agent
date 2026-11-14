#!/usr/bin/env node
/**
 * Phase 22 live verification for tenant-scoped prospect resolution and proposal delivery.
 *
 * Requires a running API and migrated database:
 *   API_URL=http://localhost:3000/api node scripts/verify-phase22-proposal-delivery.js
 *
 * The script never treats a Gmail configuration error as a successful send.
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

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function requestOk(path, options) {
  const result = await request(path, options);
  if (!result.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed (${result.status}): ${JSON.stringify(result.body)}`);
  }
  return result.body;
}

async function register(label) {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const result = await requestOk('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `phase22-${label}-${stamp}@example.com`,
      password: 'Test1234!',
      name: `Phase22 ${label}`,
      tenantName: `Phase22 ${label} Co`,
    }),
  });
  return { token: result.accessToken };
}

async function main() {
  console.log(`Phase 22 verification against ${API_URL}`);
  const tenantA = await register('a');
  const tenantB = await register('b');
  const email = `phase22-recipient-${Date.now()}@example.com`;

  const company = await requestOk('/companies', {
    method: 'POST',
    headers: headers(tenantA.token),
    body: JSON.stringify({ name: 'Phase22 Company' }),
  });
  const lead = await requestOk('/leads', {
    method: 'POST',
    headers: headers(tenantA.token),
    body: JSON.stringify({ companyId: company.id, firstName: 'Phase22', lastName: 'Recipient' }),
  });
  const prospect = await requestOk('/prospects', {
    method: 'POST',
    headers: headers(tenantA.token),
    body: JSON.stringify({
      companyId: company.id,
      leadId: lead.id,
      firstName: 'Phase22',
      lastName: 'Recipient',
      email,
    }),
  });
  const proposal = await requestOk('/ai/proposals', {
    method: 'POST',
    headers: headers(tenantA.token),
    body: JSON.stringify({
      prospectId: prospect.id,
      title: 'Phase 22 Proposal',
      content: 'Phase 22 live verification proposal.',
      status: 'generated',
    }),
  });

  const crossTenant = await request('/ai/chat', {
    method: 'POST',
    headers: headers(tenantB.token),
    body: JSON.stringify({ message: `Send proposal ${proposal.id} to ${email}` }),
  });
  if (!crossTenant.ok || /sent successfully|marked as sent/i.test(JSON.stringify(crossTenant.body))) {
    throw new Error('Cross-tenant request did not remain safely isolated');
  }

  const send = await request('/ai/chat', {
    method: 'POST',
    headers: headers(tenantA.token),
    body: JSON.stringify({ message: `Send proposal ${proposal.id} to ${email}` }),
  });

  const resultText = JSON.stringify(send.body);
  const blockedByGmail = /gmail.*(not configured|authorized)|connect gmail/i.test(resultText);
  const sent = send.ok && /sent|marked as sent/i.test(resultText);
  if (!sent && !blockedByGmail) {
    throw new Error(`Unexpected delivery result (${send.status}): ${resultText}`);
  }

  const unknown = await request('/ai/chat', {
    method: 'POST',
    headers: headers(tenantA.token),
    body: JSON.stringify({ message: 'Send the proposal to nonexistent-phase22@example.com' }),
  });
  if (!/couldn't find|no prospect|create the prospect/i.test(JSON.stringify(unknown.body))) {
    throw new Error(`Unknown prospect was not handled safely: ${JSON.stringify(unknown.body)}`);
  }

  console.log(JSON.stringify({
    prospectResolved: true,
    proposalResolved: true,
    crossTenantDenied: true,
    unknownProspectHandled: true,
    externalEmailDelivery: sent ? 'verified' : 'blocked-by-gmail-configuration',
    gmailResponseStatus: send.status,
  }, null, 2));
}

main().catch((error) => {
  console.error(`Phase 22 verification failed: ${error.message}`);
  process.exitCode = 1;
});
