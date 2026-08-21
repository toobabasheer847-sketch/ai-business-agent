import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { users } from './user.schema';
import { tasks } from './task.schema';

export const taskReminders = pgTable(
  'task_reminders',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    reminderType: varchar('reminder_type', {
      length: 32,
    }).notNull(),

    scheduledAt: timestamp('scheduled_at', {
      withTimezone: true,
    }).notNull(),

    dueAtSnapshot: timestamp('due_at_snapshot', {
      withTimezone: true,
    }).notNull(),

    status: varchar('status', {
      length: 32,
    })
      .default('pending')
      .notNull(),

    lastError: text('last_error'),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    processedAt: timestamp('processed_at', {
      withTimezone: true,
    }),
  },
  (table) => ({
    tenantIdIdx: index('task_reminders_tenant_id_idx').on(table.tenantId),
    taskIdIdx: index('task_reminders_task_id_idx').on(table.taskId),
    statusIdx: index('task_reminders_status_idx').on(table.status),
    scheduledAtIdx: index('task_reminders_scheduled_at_idx').on(
      table.scheduledAt,
    ),
    taskTypeScheduledUnique: uniqueIndex(
      'task_reminders_task_type_scheduled_unique',
    ).on(table.taskId, table.reminderType, table.scheduledAt),
  }),
);
