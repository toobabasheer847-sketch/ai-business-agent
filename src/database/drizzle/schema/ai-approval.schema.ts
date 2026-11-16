import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { agentRuns } from './agent-run.schema';
import { tenants } from './tenant.schema';
import { users } from './user.schema';

export const aiApprovals = pgTable(
  'ai_approvals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    requesterUserId: uuid('requester_user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    approverUserId: uuid('approver_user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    agentRunId: uuid('agent_run_id').references(() => agentRuns.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    agentName: varchar('agent_name', { length: 80 }),
    actionType: varchar('action_type', { length: 80 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    targetEntityType: varchar('target_entity_type', { length: 80 }).notNull(),
    targetEntityId: varchar('target_entity_id', { length: 80 }).notNull(),
    proposedPayload: jsonb('proposed_payload').notNull(),
    originalPayload: jsonb('original_payload').notNull(),
    approvedPayload: jsonb('approved_payload'),
    status: varchar('status', { length: 20 }).notNull(),
    riskLevel: varchar('risk_level', { length: 20 }).notNull(),
    reason: varchar('reason', { length: 300 }).notNull(),
    rejectionReason: varchar('rejection_reason', { length: 500 }),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    executionReference: varchar('execution_reference', { length: 200 }),
    errorSummary: varchar('error_summary', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('ai_approvals_pending_target_unique')
      .on(table.tenantId, table.actionType, table.targetEntityId, table.payloadHash)
      .where(sql`${table.status} = 'pending'`),
    index('ai_approvals_tenant_status_created_idx').on(table.tenantId, table.status, table.createdAt),
    index('ai_approvals_tenant_requester_idx').on(table.tenantId, table.requesterUserId, table.createdAt),
    index('ai_approvals_tenant_action_idx').on(table.tenantId, table.actionType),
    index('ai_approvals_tenant_risk_idx').on(table.tenantId, table.riskLevel),
  ],
);

export const aiApprovalEvents = pgTable(
  'ai_approval_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    approvalId: uuid('approval_id')
      .notNull()
      .references(() => aiApprovals.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    eventType: varchar('event_type', { length: 40 }).notNull(),
    note: varchar('note', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('ai_approval_events_approval_idx').on(table.approvalId, table.createdAt),
    index('ai_approval_events_tenant_idx').on(table.tenantId, table.createdAt),
  ],
);
