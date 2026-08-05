import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';

export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),

  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  name: varchar('name', {
    length: 255,
  }).notNull(),

  domain: varchar('domain', {
    length: 255,
  }),

  website: varchar('website', {
    length: 500,
  }),

  industry: varchar('industry', {
    length: 255,
  }),

  description: text('description'),

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