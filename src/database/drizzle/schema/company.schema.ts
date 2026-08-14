import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  decimal,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { users } from './user.schema';

export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),

  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  /** userid — nullable so existing rows stay valid. */
  userId: uuid('user_id').references(() => users.id, {
    onDelete: 'set null',
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

  /**  Category */
  category: varchar('category', {
    length: 255,
  }),

  /** Subcategory */
  subCategory: varchar('sub_category', {
    length: 255,
  }),

  /**  NoE (number of employees) */
  noe: varchar('noe', {
    length: 255,
  }),

  /**  Market Cap / market */
  market: varchar('market', {
    length: 255,
  }),

  /**  Revenue */
  revenue: decimal('revenue', {
    precision: 15,
    scale: 2,
  }),

  /**  Start Date / Establish */
  establishedDate: date('established_date'),

  region: varchar('region', {
    length: 255,
  }),

  city: varchar('city', {
    length: 255,
  }),

  country: varchar('country', {
    length: 255,
  }),

  timeZone: varchar('time_zone', {
    length: 100,
  }),

  /** : About */
  about: text('about'),

  /**  logo (URL) */
  logoUrl: varchar('logo_url', {
    length: 500,
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
