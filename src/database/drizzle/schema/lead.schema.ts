import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { companies } from './company.schema';
import { users } from './user.schema';

export const leads = pgTable('leads', {
  id: uuid('id').defaultRandom().primaryKey(),

  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  userId: uuid('user_id').references(() => users.id, {
    onDelete: 'set null',
    onUpdate: 'cascade',
  }),

  firstName: varchar('first_name', {
    length: 100,
  }).notNull(),

  lastName: varchar('last_name', {
    length: 100,
  }),

  email: varchar('email', {
    length: 255,
  }),

  phone: varchar('phone', {
    length: 50,
  }),

  whatsapp: varchar('whatsapp', {
    length: 50,
  }),

  linkedin: varchar('linkedin', {
    length: 500,
  }),

  jobTitle: varchar('job_title', {
    length: 255,
  }),

  experience: varchar('experience', {
    length: 100,
  }),

  education: varchar('education', {
    length: 255,
  }),

  source: varchar('source', {
    length: 100,
  }),

  status: varchar('status', {
    length: 50,
  })
    .notNull()
    .default('new'),

  notes: text('notes'),

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