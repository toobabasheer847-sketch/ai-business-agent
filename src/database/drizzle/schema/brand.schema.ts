import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';

export const brands = pgTable('brands', {
  id: uuid('id').defaultRandom().primaryKey(),

  tenantId: uuid('tenant_id')
    .notNull()
    .unique()
    .references(() => tenants.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  name: varchar('name', {
    length: 255,
  }).notNull(),

  logoUrl: text('logo_url'),

  domain: varchar('domain', {
    length: 255,
  }),

  apiUrl: text('api_url'),

  phone: varchar('phone', {
    length: 50,
  }),

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
