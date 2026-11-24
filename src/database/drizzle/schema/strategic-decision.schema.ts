import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';
import { users } from './user.schema';

export const strategicRecommendations = pgTable(
  'strategic_recommendations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    recommendationKey: varchar('recommendation_key', { length: 120 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: varchar('description', { length: 800 }).notNull(),
    category: varchar('category', { length: 40 }).notNull(),
    priorityScore: integer('priority_score').notNull(),
    confidenceLevel: varchar('confidence_level', { length: 20 }).notNull(),
    evidence: jsonb('evidence').notNull(),
    reasoning: varchar('reasoning', { length: 800 }).notNull(),
    suggestedAction: varchar('suggested_action', { length: 400 }).notNull(),
    expectedOutcome: varchar('expected_outcome', { length: 400 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('strategic_recommendations_key_unique').on(table.tenantId, table.recommendationKey),
    index('strategic_recommendations_tenant_idx').on(table.tenantId, table.status),
  ],
);

export const strategicPlans = pgTable(
  'strategic_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    objective: varchar('objective', { length: 400 }).notNull(),
    description: text('description').notNull(),
    category: varchar('category', { length: 40 }).notNull(),
    metricKey: varchar('metric_key', { length: 80 }).notNull(),
    baselineValue: numeric('baseline_value', { precision: 18, scale: 4 }),
    targetValue: numeric('target_value', { precision: 18, scale: 4 }),
    targetDate: timestamp('target_date', { withTimezone: true }).notNull(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('strategic_plans_tenant_idx').on(table.tenantId, table.status)],
);

export const strategicPlanMilestones = pgTable(
  'strategic_plan_milestones',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => strategicPlans.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: varchar('description', { length: 400 }).notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }),
    status: varchar('status', { length: 20 }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('strategic_plan_milestones_plan_idx').on(table.tenantId, table.planId)],
);

export const strategicPlanEvents = pgTable(
  'strategic_plan_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => strategicPlans.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    event: varchar('event', { length: 40 }).notNull(),
    fromStatus: varchar('from_status', { length: 20 }),
    toStatus: varchar('to_status', { length: 20 }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('strategic_plan_events_plan_idx').on(table.tenantId, table.planId, table.createdAt)],
);

export const strategicActionPlans = pgTable(
  'strategic_action_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    recommendationId: uuid('recommendation_id')
      .notNull()
      .references(() => strategicRecommendations.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    planId: uuid('plan_id').references(() => strategicPlans.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: varchar('description', { length: 800 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('strategic_action_plans_recommendation_unique').on(table.tenantId, table.recommendationId),
    index('strategic_action_plans_tenant_idx').on(table.tenantId, table.status),
  ],
);

export const strategicActionSteps = pgTable(
  'strategic_action_steps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    actionPlanId: uuid('action_plan_id')
      .notNull()
      .references(() => strategicActionPlans.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    position: integer('position').notNull(),
    title: varchar('title', { length: 240 }).notNull(),
    description: varchar('description', { length: 800 }).notNull(),
    actionType: varchar('action_type', { length: 40 }).notNull(),
    status: varchar('status', { length: 30 }).notNull(),
    approvalId: uuid('approval_id'),
    executionReference: varchar('execution_reference', { length: 80 }),
    note: varchar('note', { length: 400 }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('strategic_action_steps_plan_idx').on(table.tenantId, table.actionPlanId)],
);

export const businessGoals = pgTable(
  'business_goals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: varchar('description', { length: 800 }).notNull(),
    metricKey: varchar('metric_key', { length: 80 }).notNull(),
    metricDirection: varchar('metric_direction', { length: 10 }).notNull(),
    baselineValue: numeric('baseline_value', { precision: 18, scale: 4 }),
    currentValue: numeric('current_value', { precision: 18, scale: 4 }),
    targetValue: numeric('target_value', { precision: 18, scale: 4 }).notNull(),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    targetDate: timestamp('target_date', { withTimezone: true }).notNull(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('business_goals_tenant_idx').on(table.tenantId, table.status)],
);

export const businessGoalSnapshots = pgTable(
  'business_goal_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => businessGoals.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    metricValue: numeric('metric_value', { precision: 18, scale: 4 }),
    snapshotDate: timestamp('snapshot_date', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('business_goal_snapshots_day_unique').on(table.goalId, table.snapshotDate),
    index('business_goal_snapshots_tenant_idx').on(table.tenantId, table.goalId),
  ],
);

export const recommendationFeedback = pgTable(
  'recommendation_feedback',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    recommendationId: uuid('recommendation_id')
      .notNull()
      .references(() => strategicRecommendations.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    feedbackType: varchar('feedback_type', { length: 30 }).notNull(),
    feedbackReason: varchar('feedback_reason', { length: 400 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('recommendation_feedback_user_unique').on(table.recommendationId, table.userId),
    index('recommendation_feedback_tenant_idx').on(table.tenantId, table.recommendationId),
  ],
);
