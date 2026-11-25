import {
  index,
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

export const businessPerformanceDeviations = pgTable(
  'business_performance_deviations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    metricKey: varchar('metric_key', { length: 120 }).notNull(),
    metricName: varchar('metric_name', { length: 160 }).notNull(),
    deviationType: varchar('deviation_type', { length: 40 }).notNull(),
    currentValue: numeric('current_value', { precision: 18, scale: 4 }),
    baselineValue: numeric('baseline_value', { precision: 18, scale: 4 }),
    targetValue: numeric('target_value', { precision: 18, scale: 4 }),
    deviationValue: numeric('deviation_value', { precision: 18, scale: 4 }),
    deviationPercentage: numeric('deviation_percentage', { precision: 8, scale: 2 }),
    comparisonPeriod: varchar('comparison_period', { length: 80 }).notNull(),
    trendDirection: varchar('trend_direction', { length: 20 }).notNull(),
    evidence: jsonb('evidence').notNull(),
    confidenceLevel: varchar('confidence_level', { length: 20 }).notNull(),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('business_performance_deviations_period_unique').on(
      table.tenantId,
      table.metricKey,
      table.deviationType,
      table.comparisonPeriod,
    ),
    index('business_performance_deviations_tenant_idx').on(table.tenantId, table.detectedAt),
  ],
);

export const businessBottlenecks = pgTable(
  'business_bottlenecks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    fingerprint: varchar('fingerprint', { length: 160 }).notNull(),
    category: varchar('category', { length: 40 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: varchar('description', { length: 800 }).notNull(),
    affectedProcess: varchar('affected_process', { length: 120 }).notNull(),
    evidence: jsonb('evidence').notNull(),
    relatedEntityType: varchar('related_entity_type', { length: 40 }),
    relatedEntityId: varchar('related_entity_id', { length: 80 }),
    severity: varchar('severity', { length: 20 }).notNull(),
    detectionMethod: varchar('detection_method', { length: 40 }).notNull(),
    recommendedInvestigation: varchar('recommended_investigation', { length: 400 }).notNull(),
    confidenceLevel: varchar('confidence_level', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('business_bottlenecks_fingerprint_unique').on(table.tenantId, table.fingerprint),
    index('business_bottlenecks_tenant_idx').on(table.tenantId, table.status, table.detectedAt),
  ],
);

export const improvementOutcomeEvaluations = pgTable(
  'improvement_outcome_evaluations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    actionPlanId: uuid('action_plan_id').notNull(),
    goalId: uuid('goal_id'),
    metricKey: varchar('metric_key', { length: 80 }).notNull(),
    baselineValue: numeric('baseline_value', { precision: 18, scale: 4 }),
    measuredValue: numeric('measured_value', { precision: 18, scale: 4 }),
    evaluationPeriodStart: timestamp('evaluation_period_start', { withTimezone: true }).notNull(),
    evaluationPeriodEnd: timestamp('evaluation_period_end', { withTimezone: true }).notNull(),
    evaluationStatus: varchar('evaluation_status', { length: 40 }).notNull(),
    evidence: jsonb('evidence').notNull(),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('improvement_outcome_evaluations_window_unique').on(
      table.tenantId,
      table.actionPlanId,
      table.evaluationPeriodStart,
      table.evaluationPeriodEnd,
    ),
    index('improvement_outcome_evaluations_tenant_idx').on(table.tenantId, table.evaluatedAt),
  ],
);

export const businessImprovementReviews = pgTable(
  'business_improvement_reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    reviewPeriodStart: timestamp('review_period_start', { withTimezone: true }).notNull(),
    reviewPeriodEnd: timestamp('review_period_end', { withTimezone: true }).notNull(),
    summary: text('summary').notNull(),
    reviewMetrics: jsonb('review_metrics').notNull(),
    findings: jsonb('findings').notNull(),
    decision: varchar('decision', { length: 800 }),
    status: varchar('status', { length: 20 }).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('business_improvement_reviews_tenant_idx').on(table.tenantId, table.reviewPeriodEnd)],
);

export const businessImprovementEvents = pgTable(
  'business_improvement_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    eventType: varchar('event_type', { length: 60 }).notNull(),
    relatedEntityType: varchar('related_entity_type', { length: 40 }).notNull(),
    relatedEntityId: varchar('related_entity_id', { length: 80 }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    eventMetadata: jsonb('event_metadata').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('business_improvement_events_tenant_idx').on(table.tenantId, table.occurredAt),
    index('business_improvement_events_entity_idx').on(
      table.tenantId,
      table.relatedEntityType,
      table.relatedEntityId,
    ),
  ],
);
