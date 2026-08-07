import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { users } from './user.schema';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),

  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  userId: uuid('user_id').references(() => users.id, {
    onDelete: 'set null',
    onUpdate: 'cascade',
  }),

  action: varchar('action', {
    length: 100,
  }).notNull(),

  entityType: varchar('entity_type', {
    length: 100,
  }),

  entityId: uuid('entity_id'),

  description: text('description'),

  metadata: jsonb('metadata').notNull().default({}),

  createdAt: timestamp('created_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});
