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

import { tenants } from './tenant.schema';
import { users } from './user.schema';

export const operationalExceptions = pgTable(
  'operational_exceptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    exceptionKey: varchar('exception_key', { length: 160 }).notNull(),
    category: varchar('category', { length: 40 }).notNull(),
    severity: varchar('severity', { length: 20 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    sourceType: varchar('source_type', { length: 40 }).notNull(),
    sourceId: varchar('source_id', { length: 80 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull(),
    lastDetectedAt: timestamp('last_detected_at', {
      withTimezone: true,
    }).notNull(),
    occurrenceCount: integer('occurrence_count').notNull(),
    priorityScore: integer('priority_score').notNull(),
    priorityReason: varchar('priority_reason', { length: 300 }).notNull(),
    recommendedAction: varchar('recommended_action', { length: 300 }).notNull(),
    recommendedActionType: varchar('recommended_action_type', {
      length: 40,
    }).notNull(),
    assignedTo: uuid('assigned_to').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: uuid('acknowledged_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    dismissedBy: uuid('dismissed_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    resolutionNote: varchar('resolution_note', { length: 500 }),
    metadata: jsonb('metadata').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('operational_exceptions_tenant_key_unique').on(
      table.tenantId,
      table.exceptionKey,
    ),
    index('operational_exceptions_tenant_status_idx').on(
      table.tenantId,
      table.status,
      table.priorityScore,
    ),
    index('operational_exceptions_tenant_category_idx').on(
      table.tenantId,
      table.category,
    ),
    index('operational_exceptions_source_idx').on(
      table.tenantId,
      table.sourceType,
      table.sourceId,
    ),
    index('operational_exceptions_open_idx')
      .on(table.tenantId, table.lastDetectedAt)
      .where(sql`${table.status} IN ('open', 'acknowledged', 'in_progress')`),
  ],
);

export const exceptionScans = pgTable(
  'exception_scans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    trigger: varchar('trigger', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
    createdCount: integer('created_count').notNull(),
    updatedCount: integer('updated_count').notNull(),
    resolvedCount: integer('resolved_count').notNull(),
    errorSummary: varchar('error_summary', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('exception_scans_tenant_started_idx').on(
      table.tenantId,
      table.startedAt,
    ),
  ],
);
