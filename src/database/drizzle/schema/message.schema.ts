import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { conversations } from './conversation.schema';
import { users } from './user.schema';

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),

  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

  userId: uuid('user_id').references(() => users.id, {
    onDelete: 'set null',
    onUpdate: 'cascade',
  }),

  role: varchar('role', {
    length: 50,
  })
    .notNull()
    .default('user'),

  content: text('content').notNull(),

  metadata: jsonb('metadata'),

  tokenCount: integer('token_count'),

  createdAt: timestamp('created_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});
