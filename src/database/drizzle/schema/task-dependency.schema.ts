import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { tasks } from './task.schema';

export const taskDependencies = pgTable(
  'task_dependencies',
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

    dependsOnTaskId: uuid('depends_on_task_id')
      .notNull()
      .references(() => tasks.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index('task_dependencies_tenant_id_idx').on(table.tenantId),
    taskIdIdx: index('task_dependencies_task_id_idx').on(table.taskId),
    dependsOnIdx: index('task_dependencies_depends_on_idx').on(
      table.dependsOnTaskId,
    ),
    pairUnique: uniqueIndex('task_dependencies_pair_unique').on(
      table.tenantId,
      table.taskId,
      table.dependsOnTaskId,
    ),
  }),
);
