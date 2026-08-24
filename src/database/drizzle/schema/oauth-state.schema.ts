import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { users } from './user.schema';

/**
 * Short-lived, single-use OAuth CSRF state bound to the initiating user.
 * Used by the Gmail OAuth callback, which is unauthenticated.
 */
export const oauthStates = pgTable(
  'oauth_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    state: varchar('state', { length: 128 }).notNull().unique(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    purpose: varchar('purpose', { length: 64 }).notNull().default('gmail_oauth'),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    usedAt: timestamp('used_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('oauth_states_state_idx').on(table.state),
    index('oauth_states_expires_at_idx').on(table.expiresAt),
  ],
);
