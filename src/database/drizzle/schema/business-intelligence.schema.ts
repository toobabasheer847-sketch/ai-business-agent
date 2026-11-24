import { index, jsonb, numeric, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { tenants } from './tenant.schema';

export const businessForecasts = pgTable(
  'business_forecasts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    metricKey: varchar('metric_key', { length: 80 }).notNull(),
    forecastMethod: varchar('forecast_method', { length: 40 }).notNull(),
    historicalPeriodStart: timestamp('historical_period_start', { withTimezone: true }).notNull(),
    historicalPeriodEnd: timestamp('historical_period_end', { withTimezone: true }).notNull(),
    forecastPeriodStart: timestamp('forecast_period_start', { withTimezone: true }).notNull(),
    forecastPeriodEnd: timestamp('forecast_period_end', { withTimezone: true }).notNull(),
    predictedValue: numeric('predicted_value', { precision: 18, scale: 4 }),
    lowerBound: numeric('lower_bound', { precision: 18, scale: 4 }),
    upperBound: numeric('upper_bound', { precision: 18, scale: 4 }),
    confidenceLevel: varchar('confidence_level', { length: 30 }).notNull(),
    modelMetadata: jsonb('model_metadata').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('business_forecasts_window_unique').on(
      table.tenantId,
      table.metricKey,
      table.historicalPeriodStart,
      table.historicalPeriodEnd,
      table.forecastPeriodEnd,
      table.forecastMethod,
    ),
    index('business_forecasts_tenant_idx').on(table.tenantId, table.generatedAt),
  ],
);

export const predictiveInsights = pgTable(
  'predictive_insights',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    insightKey: varchar('insight_key', { length: 160 }).notNull(),
    category: varchar('category', { length: 40 }).notNull(),
    severity: varchar('severity', { length: 20 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: varchar('description', { length: 800 }).notNull(),
    evidence: varchar('evidence', { length: 800 }).notNull(),
    confidenceLevel: varchar('confidence_level', { length: 30 }).notNull(),
    recommendation: varchar('recommendation', { length: 400 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('predictive_insights_key_unique').on(table.tenantId, table.insightKey),
    index('predictive_insights_tenant_idx').on(table.tenantId, table.generatedAt),
  ],
);

export const forecastEvaluations = pgTable(
  'forecast_evaluations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    forecastId: uuid('forecast_id')
      .notNull()
      .references(() => businessForecasts.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    actualValue: numeric('actual_value', { precision: 18, scale: 4 }),
    absoluteError: numeric('absolute_error', { precision: 18, scale: 4 }),
    percentageError: numeric('percentage_error', { precision: 8, scale: 2 }),
    evaluationKind: varchar('evaluation_kind', { length: 40 }).notNull(),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('forecast_evaluations_forecast_unique').on(table.forecastId),
    index('forecast_evaluations_tenant_idx').on(table.tenantId, table.evaluatedAt),
  ],
);
