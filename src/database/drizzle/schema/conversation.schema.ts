import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { users } from './user.schema';
import { prospects } from './prospect.schema';

export const conversations = pgTable('conversations', {
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

  prospectId: uuid('prospect_id').references(() => prospects.id, {
    onDelete: 'set null',
    onUpdate: 'cascade',
  }),

  title: varchar('title', {
    length: 255,
  }),

  slug: varchar('slug', {
    length: 255,
  }).notNull(),

  channel: varchar('channel', {
    length: 50,
  })
    .notNull()
    .default('web'),

  status: varchar('status', {
    length: 50,
  })
    .notNull()
    .default('active'),

  summary: text('summary'),

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