import {
  boolean,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';

export const users = pgTable('users', {
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

  email: varchar('email', {
    length: 255,
  }).notNull(),

  passwordHash: varchar('password_hash', {
    length: 255,
  }),

  isActive: boolean('is_active')
    .default(true)
    .notNull(),

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
