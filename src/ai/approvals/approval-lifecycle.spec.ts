import { ConflictException, ForbiddenException } from '@nestjs/common';

import { ApprovalLifecycle } from './approval-lifecycle';
import { evaluateApproval, parseExtraApprovalActions } from './approval-policy';
import type { ApprovalEvent, ApprovalQuery, ApprovalRecord, ApprovalScope, ApprovalStatus, ApprovalStore, ExecutionOutcome } from './approval.types';

class MemoryStore implements ApprovalStore {
  rows: ApprovalRecord[] = [];
  eventLog: ApprovalEvent[] = [];
  private locked = false;

  async insert(row: ApprovalRecord) {
    if (this.rows.some((existing) => existing.status === 'pending' && existing.tenantId === row.tenantId && existing.actionType === row.actionType && existing.targetEntityId === row.targetEntityId && existing.payloadHash === row.payloadHash)) {
      throw new Error('duplicate');
    }
    this.rows.push({ ...row });
    return row;
  }

  async expireDue(scope: ApprovalScope, now: Date) {
    for (const row of this.rows) {
      if (row.tenantId === scope.tenantId && (!scope.userId || row.requesterUserId === scope.userId) && row.status === 'pending' && row.expiresAt.getTime() <= now.getTime()) {
        row.status = 'expired';
        row.decidedAt = now;
        await this.addEvent({ approvalId: row.id, tenantId: row.tenantId, actorUserId: null, eventType: 'expired', note: 'The approval window elapsed.' });
      }
    }
  }

  async findPendingDuplicate(tenantId: string, actionType: string, targetEntityId: string, payloadHash: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.actionType === actionType && row.targetEntityId === targetEntityId && row.payloadHash === payloadHash && row.status === 'pending') ?? null;
  }

  async find(scope: ApprovalScope, id: string) {
    const row = this.rows.find((item) => item.id === id && item.tenantId === scope.tenantId && (!scope.userId || item.requesterUserId === scope.userId));
    return row ? { ...row } : null;
  }

  async transition(scope: ApprovalScope, id: string, from: ApprovalStatus[], patch: Partial<ApprovalRecord>) {
    if (this.locked) return null;
    const row = this.rows.find((item) => item.id === id && item.tenantId === scope.tenantId && from.includes(item.status) && (!scope.userId || item.requesterUserId === scope.userId));
    if (!row) return null;
    Object.assign(row, patch, { updatedAt: new Date() });
    return { ...row };
  }

  async list(scope: ApprovalScope, query: ApprovalQuery) {
    const data = this.rows.filter((row) => row.tenantId === scope.tenantId && (!scope.userId || row.requesterUserId === scope.userId) && (!query.status || row.status === query.status));
    return { data: data.slice(query.offset, query.offset + query.limit), total: data.length };
  }

  async summary(scope: ApprovalScope) {
    const counts = { pending: 0, approved: 0, rejected: 0, executing: 0, executed: 0, failed: 0, expired: 0, cancelled: 0 };
    for (const row of this.rows) {
      if (row.tenantId === scope.tenantId && (!scope.userId || row.requesterUserId === scope.userId)) counts[row.status] += 1;
    }
    return counts;
  }

  async addEvent(event: Omit<ApprovalEvent, 'id' | 'createdAt'>) {
    this.eventLog.push({ ...event, id: `event-${this.eventLog.length}`, createdAt: new Date() });
  }

  async hasEvent(approvalId: string, actorUserId: string, eventType: string) {
    return this.eventLog.some((event) => event.approvalId === approvalId && event.actorUserId === actorUserId && event.eventType === eventType);
  }

  async events(scope: ApprovalScope, approvalId: string) {
    return this.eventLog.filter((event) => event.approvalId === approvalId && event.tenantId === scope.tenantId);
  }
}

function harness(extra: string[] = []) {
  const store = new MemoryStore();
  const calls: string[] = [];
  const registry = {
    validate: async () => undefined,
    execute: async (record: ApprovalRecord): Promise<ExecutionOutcome> => {
      calls.push(record.actionType);
      if (record.actionType === 'email.send' || record.actionType === 'sms.send') calls.push('provider');
      return { reference: 'ref-1' };
    },
  };
  return { store, calls, lifecycle: new ApprovalLifecycle(store, registry, extra, () => new Date('2026-11-15T12:00:00Z')) };
}

const owner = { tenantId: 'tenant-a', userId: 'owner-1', role: 'owner' as const };
const admin = { tenantId: 'tenant-a', userId: 'admin-1', role: 'admin' as const };
const member = { tenantId: 'tenant-a', userId: 'member-1', role: 'member' as const };

describe('approval center', () => {
  it('requires approval for external actions and not for reads or unconfigured internal changes', () => {
    expect(evaluateApproval('proposal.send').required).toBe(true);
    expect(evaluateApproval('company.delete').required).toBe(true);
    expect(evaluateApproval('email.send').required).toBe(true);
    expect(evaluateApproval('sms.send').required).toBe(true);
    expect(evaluateApproval('call.initiate').required).toBe(true);
    expect(evaluateApproval('company.create').required).toBe(false);
    expect(evaluateApproval('analytics.overview').required).toBe(false);
    expect(evaluateApproval('company.create', parseExtraApprovalActions('company.create,proposal.send')).required).toBe(true);
    expect(evaluateApproval('proposal.send', []).required).toBe(true);
  });

  it('creates a pending proposal send and does not execute it', async () => {
    const { lifecycle, calls, store } = harness();
    const result = await lifecycle.propose({ ...owner, actionType: 'proposal.send', title: 'Send proposal', description: 'Customer email', targetEntityType: 'proposal', targetEntityId: 'proposal-1', payload: { proposalId: 'proposal-1', accessToken: 'secret' } });
    expect(result.required).toBe(true);
    expect(result.approval?.status).toBe('pending');
    expect(result.approval?.originalPayload).toEqual({ proposalId: 'proposal-1' });
    expect(calls).toEqual([]);
    expect(store.eventLog.map((event) => event.eventType)).toContain('created');
  });

  it('does not create a row when approval is not required', async () => {
    const { lifecycle, store } = harness();
    const result = await lifecycle.propose({ ...owner, actionType: 'analytics.overview', title: 'Summary', description: 'Read', targetEntityType: 'analytics', targetEntityId: 'tenant-a', payload: {} });
    expect(result).toEqual({ required: false, approval: null });
    expect(store.rows).toHaveLength(0);
  });

  it('lets an owner or admin approve and execute once', async () => {
    const { lifecycle, calls } = harness();
    const created = await lifecycle.propose({ ...owner, actionType: 'company.delete', title: 'Delete company', description: 'Irreversible', targetEntityType: 'company', targetEntityId: 'company-1', payload: { companyId: 'company-1' } });
    const approved = await lifecycle.approve(admin, created.approval!.id);
    expect(approved.status).toBe('executed');
    expect(calls).toEqual(['company.delete']);
    await expect(lifecycle.approve(owner, created.approval!.id)).rejects.toBeInstanceOf(ConflictException);
    expect(calls).toEqual(['company.delete']);
  });

  it('stops a member from approving a proposal send', async () => {
    const { lifecycle, calls, store } = harness();
    const created = await lifecycle.propose({ ...owner, actionType: 'proposal.send', title: 'Send', description: 'Mail', targetEntityType: 'proposal', targetEntityId: 'proposal-1', payload: { proposalId: 'proposal-1' } });
    await expect(lifecycle.approve(member, created.approval!.id)).rejects.toThrow('not found');
    store.rows[0].requesterUserId = member.userId;
    await expect(lifecycle.approve(member, created.approval!.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(calls).toEqual([]);
  });

  it('hides another tenant approval', async () => {
    const { lifecycle } = harness();
    const created = await lifecycle.propose({ ...owner, actionType: 'company.delete', title: 'Delete', description: 'Delete', targetEntityType: 'company', targetEntityId: 'company-1', payload: { companyId: 'company-1' } });
    await expect(lifecycle.find({ ...owner, tenantId: 'tenant-b' }, created.approval!.id)).rejects.toThrow('not found');
  });

  it('rejects without executing and keeps the original snapshot', async () => {
    const { lifecycle, calls, store } = harness();
    const created = await lifecycle.propose({ ...owner, actionType: 'email.send', title: 'Email', description: 'Hello', targetEntityType: 'email', targetEntityId: 'a@example.com', payload: { to: 'a@example.com', subject: 'Hello', body: 'Draft' } });
    const rejected = await lifecycle.reject(owner, created.approval!.id, 'Wrong recipient');
    expect(rejected.status).toBe('rejected');
    expect(rejected.originalPayload.subject).toBe('Hello');
    expect(calls).toEqual([]);
    expect(store.eventLog.map((event) => event.eventType)).toContain('rejected');
  });

  it('edits an email before sending and refuses an invalid edit', async () => {
    const { lifecycle, calls } = harness();
    const created = await lifecycle.propose({ ...owner, actionType: 'email.send', title: 'Email', description: 'Hello', targetEntityType: 'email', targetEntityId: 'a@example.com', payload: { to: 'a@example.com', subject: 'Hello', body: 'Draft' } });
    await expect(lifecycle.approve(owner, created.approval!.id, { to: 'other@example.com' })).rejects.toThrow('cannot be edited');
    await expect(lifecycle.approve(owner, created.approval!.id, { subject: '   ' })).rejects.toThrow('empty or too long');
    expect(calls).toEqual([]);
    const approved = await lifecycle.approve(owner, created.approval!.id, { subject: 'Updated', body: 'Final' });
    expect(approved.approvedPayload).toMatchObject({ subject: 'Updated', body: 'Final', to: 'a@example.com' });
    expect(approved.originalPayload).toMatchObject({ subject: 'Hello' });
    expect(calls).toEqual(['email.send', 'provider']);
  });

  it('does not execute an expired approval', async () => {
    const { lifecycle, calls } = harness();
    const created = await lifecycle.propose({ ...owner, actionType: 'sms.send', title: 'SMS', description: 'Text', targetEntityType: 'sms', targetEntityId: '+15550001', payload: { to: '+15550001', body: 'Hi', fromPhoneNumberId: '11111111-1111-4111-8111-111111111111' } });
    created.approval!.expiresAt = new Date('2026-11-14T00:00:00Z');
    const stored = (lifecycle as unknown as { store: MemoryStore }).store.rows[0];
    stored.expiresAt = new Date('2026-11-14T00:00:00Z');
    await expect(lifecycle.approve(owner, created.approval!.id)).rejects.toBeInstanceOf(ConflictException);
    expect(calls).toEqual([]);
    expect(stored.status).toBe('expired');
  });

  it('returns the existing pending row for a duplicate request', async () => {
    const { lifecycle, store } = harness();
    const input = { ...owner, actionType: 'proposal.send' as const, title: 'Send', description: 'Mail', targetEntityType: 'proposal', targetEntityId: 'proposal-1', payload: { proposalId: 'proposal-1' } };
    const first = await lifecycle.propose(input);
    const second = await lifecycle.propose(input);
    expect(second.approval?.id).toBe(first.approval?.id);
    expect(store.rows).toHaveLength(1);
  });

  it('lets only one concurrent approval execute', async () => {
    const { lifecycle, store, calls } = harness();
    const created = await lifecycle.propose({ ...owner, actionType: 'company.delete', title: 'Delete', description: 'Delete', targetEntityType: 'company', targetEntityId: 'company-1', payload: { companyId: 'company-1' } });
    store.locked = true;
    await expect(lifecycle.approve(owner, created.approval!.id)).rejects.toBeInstanceOf(ConflictException);
    expect(calls).toEqual([]);
  });

  it('records a failed execution and does not send email or sms before approval', async () => {
    const store = new MemoryStore();
    let sent = 0;
    const lifecycle = new ApprovalLifecycle(store, {
      validate: async () => undefined,
      execute: async () => { sent += 1; throw new Error('provider down'); },
    });
    const created = await lifecycle.propose({ ...admin, actionType: 'email.send', title: 'Email', description: 'Hello', targetEntityType: 'email', targetEntityId: 'a@example.com', payload: { to: 'a@example.com', subject: 'Hello', body: 'Body' } });
    expect(sent).toBe(0);
    const failed = await lifecycle.approve(admin, created.approval!.id);
    expect(failed.status).toBe('failed');
    expect(failed.errorSummary).toBe('provider down');
    expect(sent).toBe(1);
    expect(store.eventLog.map((event) => event.eventType)).toEqual(expect.arrayContaining(['created', 'approved', 'failed']));
  });

  it('expires overdue approvals when the inbox is summarized', async () => {
    const { lifecycle, store } = harness();
    await lifecycle.propose({ ...owner, actionType: 'company.delete', title: 'Delete', description: 'Delete', targetEntityType: 'company', targetEntityId: 'company-1', payload: { companyId: 'company-1' } });
    store.rows[0].expiresAt = new Date('2026-11-14T00:00:00Z');
    const summary = await lifecycle.summary(owner);
    expect(summary.pending).toBe(0);
    expect(summary.expired).toBe(1);
    expect(store.eventLog.map((event) => event.eventType)).toContain('expired');
    await expect(lifecycle.approve(owner, store.rows[0].id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('summarizes pending and failed approvals', async () => {
    const { lifecycle } = harness();
    await lifecycle.propose({ ...owner, actionType: 'company.delete', title: 'Delete', description: 'Delete', targetEntityType: 'company', targetEntityId: 'company-1', payload: { companyId: 'company-1' } });
    const summary = await lifecycle.summary(owner);
    expect(summary.pending).toBe(1);
    expect(summary.executed).toBe(0);
  });
});
