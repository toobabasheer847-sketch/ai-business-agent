import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { companies } from './company.schema';
import { tasks } from './task.schema';
import { tenants } from './tenant.schema';
import { users } from './user.schema';

export const retentionPolicies = pgTable('retention_policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  inactivityDays: integer('inactivity_days').notNull().default(30),
  unansweredDays: integer('unanswered_days').notNull().default(3),
  stalledProposalDays: integer('stalled_proposal_days').notNull().default(14),
  unresolvedConversationDays: integer('unresolved_conversation_days').notNull().default(7),
  followUpDueDays: integer('follow_up_due_days').notNull().default(2),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantUnique: uniqueIndex('retention_policies_tenant_unique').on(table.tenantId),
}));

export const retentionAccounts = pgTable('retention_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  classification: varchar('classification', { length: 30 }).notNull(),
  confidence: varchar('confidence', { length: 20 }).notNull(),
  dataSufficiency: varchar('data_sufficiency', { length: 20 }).notNull(),
  explanation: varchar('explanation', { length: 800 }).notNull(),
  signalFingerprint: varchar('signal_fingerprint', { length: 2000 }).notNull().default(''),
  signals: jsonb('signals').notNull().default([]),
  lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true }),
  assessedAt: timestamp('assessed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  companyUnique: uniqueIndex('retention_accounts_company_unique').on(table.tenantId, table.companyId),
  classIdx: index('retention_accounts_class_idx').on(table.tenantId, table.classification),
}));

export const retentionAssessments = pgTable('retention_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  classification: varchar('classification', { length: 30 }).notNull(),
  confidence: varchar('confidence', { length: 20 }).notNull(),
  dataSufficiency: varchar('data_sufficiency', { length: 20 }).notNull(),
  explanation: varchar('explanation', { length: 800 }).notNull(),
  signals: jsonb('signals').notNull().default([]),
  assessedAt: timestamp('assessed_at', { withTimezone: true }).notNull(),
}, (table) => ({
  companyIdx: index('retention_assessments_company_idx').on(table.tenantId, table.companyId, table.assessedAt),
}));

export const retentionRecommendations = pgTable('retention_recommendations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  signalKey: varchar('signal_key', { length: 180 }).notNull(),
  title: varchar('title', { length: 180 }).notNull(),
  explanation: varchar('explanation', { length: 800 }).notNull(),
  action: varchar('action', { length: 500 }).notNull(),
  priority: varchar('priority', { length: 20 }).notNull(),
  confidence: varchar('confidence', { length: 20 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('open'),
  sourceType: varchar('source_type', { length: 40 }).notNull(),
  sourceId: uuid('source_id').notNull(),
  evidence: varchar('evidence', { length: 800 }).notNull(),
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  keyUnique: uniqueIndex('retention_recommendations_key_unique').on(table.tenantId, table.signalKey),
  statusIdx: index('retention_recommendations_status_idx').on(table.tenantId, table.status),
}));

export const retentionActionPlans = pgTable('retention_action_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  recommendationId: uuid('recommendation_id').references(() => retentionRecommendations.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  title: varchar('title', { length: 180 }).notNull(),
  objective: varchar('objective', { length: 500 }).notNull(),
  issue: varchar('issue', { length: 500 }).notNull(),
  priority: varchar('priority', { length: 20 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('open'),
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  dueAt: timestamp('due_at', { withTimezone: true }),
  evidence: varchar('evidence', { length: 800 }).notNull().default(''),
  expectedOutcome: varchar('expected_outcome', { length: 500 }).notNull(),
  actualOutcome: varchar('actual_outcome', { length: 500 }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  companyIdx: index('retention_action_plans_company_idx').on(table.tenantId, table.companyId),
}));

export const retentionFeedback = pgTable('retention_feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  messageId: uuid('message_id').notNull(),
  polarity: varchar('polarity', { length: 40 }).notNull(),
  excerpt: varchar('excerpt', { length: 200 }).notNull(),
  method: varchar('method', { length: 40 }).notNull().default('explicit_phrase'),
  reviewStatus: varchar('review_status', { length: 30 }).notNull().default('unreviewed'),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  messageUnique: uniqueIndex('retention_feedback_message_unique').on(table.tenantId, table.messageId),
}));
