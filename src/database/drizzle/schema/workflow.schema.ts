import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { aiApprovals } from './ai-approval.schema';
import { tenants } from './tenant.schema';
import { users } from './user.schema';

export const workflows = pgTable(
  'workflows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    triggerType: varchar('trigger_type', { length: 40 }).notNull(),
    definition: jsonb('definition').notNull(),
    version: integer('version').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('workflows_tenant_status_idx').on(table.tenantId, table.status),
    index('workflows_tenant_trigger_idx').on(table.tenantId, table.triggerType),
  ],
);

export const workflowVersions = pgTable(
  'workflow_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    version: integer('version').notNull(),
    definitionSnapshot: jsonb('definition_snapshot').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('workflow_versions_workflow_version_unique').on(table.workflowId, table.version),
    index('workflow_versions_tenant_idx').on(table.tenantId, table.workflowId),
  ],
);

export const workflowExecutions = pgTable(
  'workflow_executions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    workflowVersion: integer('workflow_version').notNull(),
    triggerSource: varchar('trigger_source', { length: 20 }).notNull(),
    triggerReference: varchar('trigger_reference', { length: 160 }).notNull(),
    status: varchar('status', { length: 30 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    errorCode: varchar('error_code', { length: 80 }),
    sanitizedError: varchar('sanitized_error', { length: 300 }),
    executionContext: jsonb('execution_context').notNull(),
    triggeredBy: uuid('triggered_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    definitionSnapshot: jsonb('definition_snapshot').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('workflow_executions_trigger_unique').on(table.tenantId, table.workflowId, table.triggerReference),
    index('workflow_executions_tenant_status_idx').on(table.tenantId, table.status, table.startedAt),
    index('workflow_executions_tenant_started_idx').on(table.tenantId, table.startedAt),
    index('workflow_executions_workflow_idx').on(table.workflowId, table.startedAt),
    index('workflow_executions_waiting_idx')
      .on(table.tenantId, table.startedAt)
      .where(sql`${table.status} = 'waiting_for_approval'`),
  ],
);

export const workflowExecutionSteps = pgTable(
  'workflow_execution_steps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => workflowExecutions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    stepKey: varchar('step_key', { length: 40 }).notNull(),
    actionType: varchar('action_type', { length: 60 }).notNull(),
    status: varchar('status', { length: 30 }).notNull(),
    inputSnapshot: jsonb('input_snapshot').notNull(),
    outputSnapshot: jsonb('output_snapshot').notNull(),
    approvalId: uuid('approval_id').references(() => aiApprovals.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    attemptCount: integer('attempt_count').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorCode: varchar('error_code', { length: 80 }),
    sanitizedError: varchar('sanitized_error', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('workflow_execution_steps_key_unique').on(table.executionId, table.stepKey),
    index('workflow_execution_steps_tenant_idx').on(table.tenantId, table.executionId),
    index('workflow_execution_steps_approval_idx').on(table.approvalId),
    index('workflow_execution_steps_tenant_action_idx').on(table.tenantId, table.actionType),
  ],
);

export const workflowRecommendations = pgTable(
  'workflow_optimization_recommendations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    recommendationKey: varchar('recommendation_key', { length: 200 }).notNull(),
    rule: varchar('rule', { length: 40 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    evidence: varchar('evidence', { length: 800 }).notNull(),
    suggestion: varchar('suggestion', { length: 400 }).notNull(),
    impact: varchar('impact', { length: 300 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    metrics: jsonb('metrics').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('workflow_recommendations_key_unique').on(table.tenantId, table.recommendationKey),
    index('workflow_recommendations_tenant_status_idx').on(table.tenantId, table.status),
  ],
);
