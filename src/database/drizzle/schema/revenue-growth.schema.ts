import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { companies } from './company.schema';
import { leads } from './lead.schema';
import { proposals } from './proposal.schema';
import { prospects } from './prospect.schema';
import { tasks } from './task.schema';
import { tenants } from './tenant.schema';
import { users } from './user.schema';

export const growthPolicies = pgTable('growth_policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  leadQuietDays: integer('lead_quiet_days').notNull().default(21),
  proposalFollowUpDays: integer('proposal_follow_up_days').notNull().default(7),
  lastInsufficientLeads: integer('last_insufficient_leads').notNull().default(0),
  lastTruncated: boolean('last_truncated').notNull().default(false),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantUnique: uniqueIndex('growth_policies_tenant_unique').on(table.tenantId),
}));

export const growthOpportunities = pgTable('growth_opportunities', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  proposalId: uuid('proposal_id').references(() => proposals.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  signalKey: varchar('signal_key', { length: 180 }).notNull(),
  opportunityType: varchar('opportunity_type', { length: 40 }).notNull(),
  title: varchar('title', { length: 180 }).notNull(),
  description: varchar('description', { length: 800 }).notNull(),
  evidence: varchar('evidence', { length: 800 }).notNull(),
  explicit: boolean('explicit').notNull().default(false),
  sourceType: varchar('source_type', { length: 40 }).notNull(),
  sourceId: uuid('source_id').notNull(),
  priority: varchar('priority', { length: 20 }).notNull(),
  priorityRank: integer('priority_rank').notNull(),
  prioritySource: varchar('priority_source', { length: 20 }).notNull().default('heuristic'),
  confidence: varchar('confidence', { length: 20 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('identified'),
  recommendedAction: varchar('recommended_action', { length: 400 }).notNull(),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  outcome: varchar('outcome', { length: 500 }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  keyUnique: uniqueIndex('growth_opportunities_key_unique').on(table.tenantId, table.signalKey),
  statusIdx: index('growth_opportunities_status_idx').on(table.tenantId, table.status),
}));

export const growthOpportunityEvents = pgTable('growth_opportunity_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  opportunityId: uuid('opportunity_id').notNull().references(() => growthOpportunities.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  fromStatus: varchar('from_status', { length: 30 }),
  toStatus: varchar('to_status', { length: 30 }).notNull(),
  note: varchar('note', { length: 400 }).notNull(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  opportunityIdx: index('growth_opportunity_events_idx').on(table.tenantId, table.opportunityId, table.createdAt),
}));

export const growthActionPlans = pgTable('growth_action_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  opportunityId: uuid('opportunity_id').notNull().references(() => growthOpportunities.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  objective: varchar('objective', { length: 500 }).notNull(),
  expectedOutcome: varchar('expected_outcome', { length: 500 }).notNull(),
  actualOutcome: varchar('actual_outcome', { length: 500 }),
  priority: varchar('priority', { length: 20 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('open'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  dueAt: timestamp('due_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  opportunityIdx: index('growth_action_plans_opportunity_idx').on(table.tenantId, table.opportunityId),
}));
