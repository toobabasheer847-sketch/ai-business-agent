CREATE TABLE IF NOT EXISTS "business_performance_deviations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "metric_key" varchar(120) NOT NULL,
  "metric_name" varchar(160) NOT NULL,
  "deviation_type" varchar(40) NOT NULL,
  "current_value" numeric(18, 4),
  "baseline_value" numeric(18, 4),
  "target_value" numeric(18, 4),
  "deviation_value" numeric(18, 4),
  "deviation_percentage" numeric(8, 2),
  "comparison_period" varchar(80) NOT NULL,
  "trend_direction" varchar(20) NOT NULL,
  "evidence" jsonb NOT NULL,
  "confidence_level" varchar(20) NOT NULL,
  "detected_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "business_bottlenecks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "fingerprint" varchar(160) NOT NULL,
  "category" varchar(40) NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" varchar(800) NOT NULL,
  "affected_process" varchar(120) NOT NULL,
  "evidence" jsonb NOT NULL,
  "related_entity_type" varchar(40),
  "related_entity_id" varchar(80),
  "severity" varchar(20) NOT NULL,
  "detection_method" varchar(40) NOT NULL,
  "recommended_investigation" varchar(400) NOT NULL,
  "confidence_level" varchar(20) NOT NULL,
  "status" varchar(20) NOT NULL,
  "detected_at" timestamp with time zone NOT NULL,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "improvement_outcome_evaluations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "action_plan_id" uuid NOT NULL,
  "goal_id" uuid,
  "metric_key" varchar(80) NOT NULL,
  "baseline_value" numeric(18, 4),
  "measured_value" numeric(18, 4),
  "evaluation_period_start" timestamp with time zone NOT NULL,
  "evaluation_period_end" timestamp with time zone NOT NULL,
  "evaluation_status" varchar(40) NOT NULL,
  "evidence" jsonb NOT NULL,
  "evaluated_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "business_improvement_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "review_period_start" timestamp with time zone NOT NULL,
  "review_period_end" timestamp with time zone NOT NULL,
  "summary" text NOT NULL,
  "review_metrics" jsonb NOT NULL,
  "findings" jsonb NOT NULL,
  "decision" varchar(800),
  "status" varchar(20) NOT NULL,
  "created_by" uuid,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "business_improvement_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "event_type" varchar(60) NOT NULL,
  "related_entity_type" varchar(40) NOT NULL,
  "related_entity_id" varchar(80),
  "actor_id" uuid,
  "event_metadata" jsonb NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "strategic_plans" ADD COLUMN IF NOT EXISTS "plan_kind" varchar(20) DEFAULT 'strategic' NOT NULL;
ALTER TABLE "strategic_plans" ADD COLUMN IF NOT EXISTS "related_goal_id" uuid;
ALTER TABLE "strategic_plans" ADD COLUMN IF NOT EXISTS "related_recommendation_id" uuid;
ALTER TABLE "strategic_plans" ADD COLUMN IF NOT EXISTS "evidence" jsonb;
ALTER TABLE "strategic_plans" ADD COLUMN IF NOT EXISTS "review_schedule" varchar(20);
ALTER TABLE "strategic_plans" ADD COLUMN IF NOT EXISTS "next_review_at" timestamp with time zone;

DO $$ BEGIN
  ALTER TABLE "business_performance_deviations" ADD CONSTRAINT "business_performance_deviations_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "business_bottlenecks" ADD CONSTRAINT "business_bottlenecks_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "improvement_outcome_evaluations" ADD CONSTRAINT "improvement_outcome_evaluations_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "business_improvement_reviews" ADD CONSTRAINT "business_improvement_reviews_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "business_improvement_reviews" ADD CONSTRAINT "business_improvement_reviews_user_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "business_improvement_events" ADD CONSTRAINT "business_improvement_events_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "business_improvement_events" ADD CONSTRAINT "business_improvement_events_user_fk"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_plans" ADD CONSTRAINT "strategic_plans_recommendation_fk"
    FOREIGN KEY ("related_recommendation_id") REFERENCES "strategic_recommendations"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "business_performance_deviations_period_unique"
  ON "business_performance_deviations" ("tenant_id", "metric_key", "deviation_type", "comparison_period");
CREATE INDEX IF NOT EXISTS "business_performance_deviations_tenant_idx"
  ON "business_performance_deviations" ("tenant_id", "detected_at");
CREATE UNIQUE INDEX IF NOT EXISTS "business_bottlenecks_fingerprint_unique"
  ON "business_bottlenecks" ("tenant_id", "fingerprint");
CREATE INDEX IF NOT EXISTS "business_bottlenecks_tenant_idx"
  ON "business_bottlenecks" ("tenant_id", "status", "detected_at");
CREATE UNIQUE INDEX IF NOT EXISTS "improvement_outcome_evaluations_window_unique"
  ON "improvement_outcome_evaluations" ("tenant_id", "action_plan_id", "evaluation_period_start", "evaluation_period_end");
CREATE INDEX IF NOT EXISTS "improvement_outcome_evaluations_tenant_idx"
  ON "improvement_outcome_evaluations" ("tenant_id", "evaluated_at");
CREATE INDEX IF NOT EXISTS "business_improvement_reviews_tenant_idx"
  ON "business_improvement_reviews" ("tenant_id", "review_period_end");
CREATE INDEX IF NOT EXISTS "business_improvement_events_tenant_idx"
  ON "business_improvement_events" ("tenant_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "business_improvement_events_entity_idx"
  ON "business_improvement_events" ("tenant_id", "related_entity_type", "related_entity_id");
CREATE INDEX IF NOT EXISTS "strategic_plans_kind_idx"
  ON "strategic_plans" ("tenant_id", "plan_kind");

ALTER TABLE "strategic_plans" DROP CONSTRAINT IF EXISTS "strategic_plans_status_check";
DO $$ BEGIN
  ALTER TABLE "strategic_plans" ADD CONSTRAINT "strategic_plans_status_check"
    CHECK ("status" IN ('DRAFT', 'REVIEW_REQUIRED', 'APPROVED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
