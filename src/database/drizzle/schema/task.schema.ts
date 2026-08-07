import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { users } from './user.schema';

export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
]);

export const taskPriorityEnum = pgEnum('task_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    assignedTo: uuid('assigned_to').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    title: varchar('title', {
      length: 255,
    }).notNull(),

    description: text('description'),

    status: taskStatusEnum('status').default('pending').notNull(),

    priority: taskPriorityEnum('priority').default('medium').notNull(),

    dueAt: timestamp('due_at', { withTimezone: true }),

    completedAt: timestamp('completed_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index('tasks_tenant_id_idx').on(table.tenantId),
    assignedToIdx: index('tasks_assigned_to_idx').on(table.assignedTo),
    statusIdx: index('tasks_status_idx').on(table.status),
    dueAtIdx: index('tasks_due_at_idx').on(table.dueAt),
    tenantStatusIdx: index('tasks_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
  }),
);
