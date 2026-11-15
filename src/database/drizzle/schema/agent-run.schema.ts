import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { users } from './user.schema';

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    agentName: varchar('agent_name', { length: 80 }).notNull(),
    correlationId: uuid('correlation_id').notNull(),
    parentRunId: uuid('parent_run_id'),
    providerExecutionId: uuid('provider_execution_id').notNull(),
    provider: varchar('provider', { length: 40 }).notNull(),
    model: varchar('model', { length: 120 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    usageStatus: varchar('usage_status', { length: 40 }).notNull(),
    usageNote: varchar('usage_note', { length: 200 }),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    totalTokens: integer('total_tokens'),
    costStatus: varchar('cost_status', { length: 40 }).notNull(),
    estimatedInputCost: numeric('estimated_input_cost', { precision: 18, scale: 8 }),
    estimatedOutputCost: numeric('estimated_output_cost', { precision: 18, scale: 8 }),
    estimatedTotalCost: numeric('estimated_total_cost', { precision: 18, scale: 8 }),
    currency: varchar('currency', { length: 8 }),
    pricingSource: text('pricing_source'),
    pricingEffectiveDate: varchar('pricing_effective_date', { length: 10 }),
    durationMs: integer('duration_ms'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorCode: varchar('error_code', { length: 80 }),
    errorSummary: varchar('error_summary', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('agent_runs_provider_execution_id_unique').on(table.providerExecutionId),
    index('agent_runs_tenant_started_idx').on(table.tenantId, table.startedAt),
    index('agent_runs_tenant_user_started_idx').on(table.tenantId, table.userId, table.startedAt),
    index('agent_runs_tenant_agent_idx').on(table.tenantId, table.agentName),
    index('agent_runs_tenant_status_idx').on(table.tenantId, table.status),
    index('agent_runs_correlation_idx').on(table.correlationId),
  ],
);
