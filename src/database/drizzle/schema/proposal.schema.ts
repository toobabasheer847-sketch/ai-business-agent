import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { prospects } from './prospect.schema';
import { users } from './user.schema';

export const proposals = pgTable('proposals', {
  id: uuid('id').defaultRandom().primaryKey(),

  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  prospectId: uuid('prospect_id')
    .notNull()
    .references(() => prospects.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  createdBy: uuid('created_by').references(() => users.id, {
    onDelete: 'set null',
    onUpdate: 'cascade',
  }),

  title: varchar('title', {
    length: 255,
  }).notNull(),

  description: text('description'),

  status: varchar('status', {
    length: 50,
  })
    .notNull()
    .default('draft'),

  content: text('content'),

  createdAt: timestamp('created_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp('updated_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});
