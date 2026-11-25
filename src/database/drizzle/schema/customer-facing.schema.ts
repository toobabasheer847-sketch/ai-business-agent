import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { companies } from './company.schema';
import { conversations } from './conversation.schema';
import { knowledgebases } from './knowledgebase.schema';
import { leads } from './lead.schema';
import { tenants } from './tenant.schema';
import { users } from './user.schema';

export const customerAiSettings = pgTable(
  'customer_ai_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    publicKey: varchar('public_key', { length: 32 }).notNull(),
    enabled: boolean('enabled').notNull().default(false),
    displayName: varchar('display_name', { length: 80 }).notNull(),
    welcomeMessage: varchar('welcome_message', { length: 400 }).notNull(),
    instructions: varchar('instructions', { length: 1000 }).notNull().default(''),
    leadCaptureEnabled: boolean('lead_capture_enabled').notNull().default(false),
    handoffNotificationsEnabled: boolean('handoff_notifications_enabled').notNull().default(true),
    knowledgeBaseId: uuid('knowledge_base_id').references(() => knowledgebases.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    collectName: boolean('collect_name').notNull().default(true),
    collectEmail: boolean('collect_email').notNull().default(true),
    collectPhone: boolean('collect_phone').notNull().default(false),
    accent: varchar('accent', { length: 20 }).notNull().default('slate'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('customer_ai_settings_tenant_unique').on(table.tenantId),
    uniqueIndex('customer_ai_settings_public_key_unique').on(table.publicKey),
  ],
);

export const customerChatSessions = pgTable(
  'customer_chat_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('customer_chat_sessions_token_unique').on(table.tokenHash),
    index('customer_chat_sessions_conversation_idx').on(table.tenantId, table.conversationId),
  ],
);

export const customerAiStates = pgTable(
  'customer_ai_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    intent: varchar('intent', { length: 40 }).notNull(),
    confidence: varchar('confidence', { length: 20 }).notNull(),
    intentSource: varchar('intent_source', { length: 40 }).notNull(),
    intentEvidence: varchar('intent_evidence', { length: 400 }).notNull(),
    handoffReason: varchar('handoff_reason', { length: 400 }),
    handoffAt: timestamp('handoff_at', { withTimezone: true }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    visitorName: varchar('visitor_name', { length: 120 }),
    visitorEmail: varchar('visitor_email', { length: 255 }),
    visitorPhone: varchar('visitor_phone', { length: 50 }),
    requirements: text('requirements'),
    summary: text('summary').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('customer_ai_states_conversation_unique').on(table.conversationId),
    index('customer_ai_states_tenant_idx').on(table.tenantId, table.status, table.updatedAt),
  ],
);
