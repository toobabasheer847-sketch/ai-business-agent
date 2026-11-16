import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { hasPermission, Permission } from '../../modules/authorization/permissions';
import { applyApprovalEdits, payloadHash, sanitizeApprovalPayload } from './approval-payload';
import { canDecideApproval, evaluateApproval, parseExtraApprovalActions } from './approval-policy';
import type {
  ApprovalEvent,
  ApprovalExecutorRegistry,
  ApprovalQuery,
  ApprovalRecord,
  ApprovalScope,
  ApprovalStatus,
  ApprovalStore,
} from './approval.types';

const TTL_MS = 24 * 60 * 60 * 1000;
const STATUSES: ApprovalStatus[] = ['pending', 'approved', 'rejected', 'executing', 'executed', 'failed', 'expired', 'cancelled'];

export type Actor = { tenantId: string; userId: string; role?: string };

export class ApprovalLifecycle {
  constructor(
    private readonly store: ApprovalStore,
    private readonly registry: ApprovalExecutorRegistry,
    private readonly extraRequired: string[] = [],
    private readonly now: () => Date = () => new Date(),
  ) {}

  async propose(input: {
    tenantId: string;
    userId: string;
    role?: string;
    actionType: string;
    title: string;
    description: string;
    targetEntityType: string;
    targetEntityId: string;
    payload: Record<string, unknown>;
    agentName?: string | null;
    agentRunId?: string | null;
  }): Promise<{ required: boolean; approval: ApprovalRecord | null }> {
    const policy = evaluateApproval(input.actionType, this.extraRequired);
    if (!policy.required) return { required: false, approval: null };
    if (policy.permission && !hasPermission(input.role, policy.permission)) {
      throw new ForbiddenException('You do not have permission to request this action.');
    }
    const payload = sanitizeApprovalPayload(input.payload);
    const hash = payloadHash(payload);
    const existing = await this.store.findPendingDuplicate(input.tenantId, input.actionType, input.targetEntityId, hash);
    if (existing) return { required: true, approval: existing };
    const createdAt = this.now();
    const row: ApprovalRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      requesterUserId: input.userId,
      approverUserId: null,
      agentRunId: input.agentRunId ?? null,
      agentName: input.agentName ?? null,
      actionType: input.actionType,
      title: input.title.slice(0, 200),
      description: input.description.slice(0, 500),
      targetEntityType: input.targetEntityType.slice(0, 80),
      targetEntityId: input.targetEntityId.slice(0, 80),
      proposedPayload: payload,
      originalPayload: payload,
      approvedPayload: null,
      status: 'pending',
      riskLevel: policy.riskLevel,
      reason: policy.reason,
      rejectionReason: null,
      payloadHash: hash,
      expiresAt: new Date(createdAt.getTime() + TTL_MS),
      decidedAt: null,
      executedAt: null,
      executionReference: null,
      errorSummary: null,
      createdAt,
      updatedAt: createdAt,
    };
    const saved = await this.store.insert(row);
    await this.store.addEvent({ approvalId: saved.id, tenantId: saved.tenantId, actorUserId: input.userId, eventType: 'created', note: policy.reason });
    return { required: true, approval: saved };
  }

  async list(actor: Actor, query: ApprovalQuery) {
    const scope = this.scope(actor);
    await this.store.expireDue(scope, this.now());
    const result = await this.store.list(scope, query);
    return { ...result, page: query.page, limit: query.limit };
  }

  async summary(actor: Actor) {
    const scope = this.scope(actor);
    await this.store.expireDue(scope, this.now());
    return this.store.summary(scope);
  }

  async find(actor: Actor, id: string): Promise<ApprovalRecord> {
    const record = await this.visible(actor, id);
    if (!(await this.store.hasEvent(record.id, actor.userId, 'viewed'))) {
      await this.store.addEvent({ approvalId: record.id, tenantId: record.tenantId, actorUserId: actor.userId, eventType: 'viewed', note: null });
    }
    return record;
  }

  async events(actor: Actor, id: string): Promise<ApprovalEvent[]> {
    await this.visible(actor, id);
    return this.store.events(this.scope(actor), id);
  }

  async approve(actor: Actor, id: string, edits?: Record<string, unknown>): Promise<ApprovalRecord> {
    const current = await this.visible(actor, id);
    this.assertPending(current);
    const policy = evaluateApproval(current.actionType, this.extraRequired);
    if (!canDecideApproval(actor.role, policy)) {
      throw new ForbiddenException('You do not have permission to approve this action.');
    }
    let finalPayload: Record<string, unknown>;
    try {
      finalPayload = applyApprovalEdits(current.originalPayload, edits, policy.editableFields);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'The edited action is not valid.');
    }
    await this.registry.validate({ ...current, approvedPayload: finalPayload });
    if (edits && Object.keys(edits).length) {
      await this.store.addEvent({ approvalId: current.id, tenantId: current.tenantId, actorUserId: actor.userId, eventType: 'edited', note: 'Approved values differ from the original proposal.' });
    }
    const approved = await this.store.transition(this.scope(actor), id, ['pending'], {
      status: 'approved',
      approverUserId: actor.userId,
      approvedPayload: finalPayload,
      decidedAt: this.now(),
    });
    if (!approved) throw new ConflictException('This approval was already decided.');
    await this.store.addEvent({ approvalId: id, tenantId: actor.tenantId, actorUserId: actor.userId, eventType: 'approved', note: null });
    const executing = await this.store.transition(this.scope(actor), id, ['approved'], { status: 'executing' });
    if (!executing) throw new ConflictException('This approval was already decided.');
    await this.store.addEvent({ approvalId: id, tenantId: actor.tenantId, actorUserId: actor.userId, eventType: 'executing', note: null });
    try {
      const outcome = await this.registry.execute({ ...executing, approvedPayload: finalPayload });
      if (outcome.uncertain) {
        return this.finish(actor, id, 'failed', 'Delivery status is uncertain and was not retried.', null);
      }
      return this.finish(actor, id, 'executed', null, outcome.reference);
    } catch (error) {
      const summary = error instanceof Error ? error.message : 'Execution failed.';
      return this.finish(actor, id, 'failed', summary.slice(0, 300), null);
    }
  }

  async reject(actor: Actor, id: string, reason: string): Promise<ApprovalRecord> {
    const current = await this.visible(actor, id);
    this.assertPending(current);
    const policy = evaluateApproval(current.actionType, this.extraRequired);
    if (!canDecideApproval(actor.role, policy)) throw new ForbiddenException('You do not have permission to reject this action.');
    const rejectionReason = reason?.trim() ?? '';
    if (rejectionReason.length < 3) throw new BadRequestException('A rejection reason is required.');
    const updated = await this.store.transition(this.scope(actor), id, ['pending'], {
      status: 'rejected',
      approverUserId: actor.userId,
      rejectionReason: rejectionReason.slice(0, 500),
      decidedAt: this.now(),
    });
    if (!updated) throw new ConflictException('This approval was already decided.');
    await this.store.addEvent({ approvalId: id, tenantId: actor.tenantId, actorUserId: actor.userId, eventType: 'rejected', note: rejectionReason.slice(0, 500) });
    return updated;
  }

  async cancel(actor: Actor, id: string): Promise<ApprovalRecord> {
    const current = await this.visible(actor, id);
    this.assertPending(current);
    const policy = evaluateApproval(current.actionType, this.extraRequired);
    const allowed = current.requesterUserId === actor.userId || canDecideApproval(actor.role, policy);
    if (!allowed) throw new ForbiddenException('You do not have permission to cancel this action.');
    const updated = await this.store.transition(this.scope(actor), id, ['pending'], {
      status: 'cancelled',
      decidedAt: this.now(),
    });
    if (!updated) throw new ConflictException('This approval was already decided.');
    await this.store.addEvent({ approvalId: id, tenantId: actor.tenantId, actorUserId: actor.userId, eventType: 'cancelled', note: null });
    return updated;
  }

  private async finish(actor: Actor, id: string, status: 'executed' | 'failed', errorSummary: string | null, reference: string | null) {
    const updated = await this.store.transition({ tenantId: actor.tenantId }, id, ['executing'], {
      status,
      executedAt: this.now(),
      executionReference: reference,
      errorSummary,
    });
    await this.store.addEvent({
      approvalId: id,
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      eventType: status === 'executed' ? 'executed' : 'failed',
      note: errorSummary,
    });
    if (!updated) throw new ConflictException('This approval execution was already recorded.');
    return updated;
  }

  private async visible(actor: Actor, id: string): Promise<ApprovalRecord> {
    const scope = this.scope(actor);
    const record = await this.store.find(scope, id);
    if (!record || record.tenantId !== actor.tenantId) throw new NotFoundException('Approval not found.');
    if (scope.userId && record.requesterUserId !== actor.userId) throw new NotFoundException('Approval not found.');
    if (record.status === 'pending' && record.expiresAt.getTime() <= this.now().getTime()) {
      const expired = await this.store.transition(scope, id, ['pending'], { status: 'expired', decidedAt: this.now() });
      if (expired) {
        await this.store.addEvent({ approvalId: id, tenantId: actor.tenantId, actorUserId: null, eventType: 'expired', note: 'The approval window elapsed.' });
        return expired;
      }
    }
    return record;
  }

  private assertPending(record: ApprovalRecord) {
    if (record.status === 'expired') throw new ConflictException('This approval has expired.');
    if (record.status === 'executed') throw new ConflictException('This approval was already executed.');
    if (record.status !== 'pending') throw new ConflictException('This approval is no longer pending.');
  }

  private scope(actor: Actor): ApprovalScope {
    if (hasPermission(actor.role, Permission.AuditView)) return { tenantId: actor.tenantId };
    return { tenantId: actor.tenantId, userId: actor.userId };
  }
}

export function parseApprovalQuery(query: {
  page?: string;
  limit?: string;
  status?: string;
  riskLevel?: string;
  actionType?: string;
  agent?: string;
  requesterUserId?: string;
  from?: string;
  to?: string;
  sort?: string;
  direction?: string;
}): ApprovalQuery {
  if (query.sort && query.sort !== 'createdAt') throw new BadRequestException('Approvals can only be sorted by createdAt.');
  if (query.direction && query.direction !== 'desc') throw new BadRequestException('Approvals can only be sorted descending.');
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 50;
  if (!Number.isInteger(page) || page < 1) throw new BadRequestException('page must be an integer of at least 1.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('limit must be an integer from 1 to 100.');
  const status = query.status?.trim();
  if (status && !STATUSES.includes(status as ApprovalStatus)) throw new BadRequestException('status is not a known approval status.');
  const riskLevel = query.riskLevel?.trim();
  if (riskLevel && !['low', 'medium', 'high'].includes(riskLevel)) throw new BadRequestException('riskLevel must be low, medium, or high.');
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    status: status as ApprovalStatus | undefined,
    riskLevel: riskLevel as ApprovalQuery['riskLevel'],
    actionType: bounded(query.actionType, 80),
    agentName: bounded(query.agent, 80),
    requesterUserId: bounded(query.requesterUserId, 80),
    from: parseDate(query.from, 'from'),
    to: parseDate(query.to, 'to'),
  };
}

export { parseExtraApprovalActions };

function bounded(value: string | undefined, max: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) throw new BadRequestException('A filter value is too long.');
  return trimmed;
}

function parseDate(value: string | undefined, field: string): Date | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const date = field === 'to' && /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? new Date(`${trimmed}T23:59:59.999Z`) : new Date(trimmed);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} must be a valid date.`);
  return date;
}
