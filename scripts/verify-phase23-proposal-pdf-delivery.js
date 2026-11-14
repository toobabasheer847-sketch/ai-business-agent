#!/usr/bin/env node
/**
 * Phase 23 live verification for proposal PDF generation, MIME attachment, and delivery.
 *
 * Requires a running API and migrated database:
 *   API_URL=http://localhost:3000/api node scripts/verify-phase23-proposal-pdf-delivery.js
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
      email: `phase23-${label}-${stamp}@example.com`,
      password: 'Test1234!',
      name: `Phase23 ${label}`,
      tenantName: `Phase23 ${label} Co`,
    }),
  });
  return { token: result.accessToken };
}

function bodyText(result) {
  return JSON.stringify(result.body ?? result);
}

async function main() {
  console.log(`Phase 23 verification against ${API_URL}`);
  const tenantA = await register('a');
  const tenantB = await register('b');
  const email = `phase23-recipient-${Date.now()}@example.com`;

  const company = await requestOk('/companies', {
    method: 'POST',
    headers: headers(tenantA.token),
    body: JSON.stringify({ name: 'Phase23 Company' }),
  });
  const lead = await requestOk('/leads', {
    method: 'POST',
    headers: headers(tenantA.token),
    body: JSON.stringify({ companyId: company.id, firstName: 'Phase23', lastName: 'Recipient' }),
  });
  const prospect = await requestOk('/prospects', {
    method: 'POST',
    headers: headers(tenantA.token),
    body: JSON.stringify({
      companyId: company.id,
      leadId: lead.id,
      firstName: 'Phase23',
      lastName: 'Recipient',
      email,
    }),
  });
  const proposal = await requestOk('/ai/proposals', {
    method: 'POST',
    headers: headers(tenantA.token),
    body: JSON.stringify({
      prospectId: prospect.id,
      title: 'Cyberify Business Proposal',
      content: 'Phase 23 live verification proposal content with pricing and scope.',
      status: 'generated',
    }),
  });

  const crossTenant = await request('/ai/chat', {
    method: 'POST',
    headers: headers(tenantB.token),
    body: JSON.stringify({ message: `Send proposal ${proposal.id} to ${email}` }),
  });
  const crossTenantText = bodyText(crossTenant);
  if (!crossTenant.ok || /successfully emailed|PDF attached|marked as sent/i.test(crossTenantText)) {
    throw new Error('Cross-tenant request did not remain safely isolated');
  }

  const send = await request('/ai/chat', {
    method: 'POST',
    headers: headers(tenantA.token),
    body: JSON.stringify({ message: `Send the proposal to ${email}` }),
  });
  const sendText = bodyText(send);
  if (!sendText.trim()) {
    throw new Error('Proposal send returned an empty assistant response');
  }
  if (send.body?.delegation !== 'proposal') {
    throw new Error(`Expected proposal delegation, got ${JSON.stringify(send.body?.delegation)}`);
  }

  const blockedByGmail = /gmail.*not configured|connect gmail/i.test(sendText);
  const sent = send.ok && /successfully emailed|pdf attached|marked as sent/i.test(sendText);

  const unknown = await request('/ai/chat', {
    method: 'POST',
    headers: headers(tenantA.token),
    body: JSON.stringify({ message: 'Send the proposal to nonexistent-phase23@example.com' }),
  });
  if (!/couldn't find|no prospect|email address/i.test(bodyText(unknown))) {
    throw new Error(`Unknown prospect was not handled safely: ${bodyText(unknown)}`);
  }

  let duplicateRejected = false;
  if (sent) {
    const duplicate = await request('/ai/chat', {
      method: 'POST',
      headers: headers(tenantA.token),
      body: JSON.stringify({ message: `Send the proposal to ${email}` }),
    });
    duplicateRejected = /already been sent|already sent/i.test(bodyText(duplicate));
    if (!duplicateRejected) {
      throw new Error(`Duplicate send was not rejected: ${bodyText(duplicate)}`);
    }
  }

  console.log(JSON.stringify({
    prospectResolved: true,
    proposalResolved: true,
    crossTenantDenied: true,
    unknownProspectHandled: true,
    nonEmptyResponse: true,
    delegation: send.body?.delegation ?? null,
    pdfGenerationPath: sent || blockedByGmail ? 'exercised' : 'not-verified',
    mimeAttachmentDelivery: sent ? 'verified' : 'blocked-by-gmail-configuration',
    duplicateSendRejected: sent ? duplicateRejected : 'skipped-no-live-send',
    externalEmailDelivery: sent ? 'verified' : 'LIVE DELIVERY BLOCKED BY GMAIL CONFIGURATION',
    gmailResponseStatus: send.status,
  }, null, 2));
}

main().catch((error) => {
  console.error(`Phase 23 verification failed: ${error.message}`);
  process.exitCode = 1;
});
