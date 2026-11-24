CREATE TABLE IF NOT EXISTS "strategic_recommendations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "recommendation_key" varchar(120) NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" varchar(800) NOT NULL,
  "category" varchar(40) NOT NULL,
  "priority_score" integer NOT NULL,
  "confidence_level" varchar(20) NOT NULL,
  "evidence" jsonb NOT NULL,
  "reasoning" varchar(800) NOT NULL,
  "suggested_action" varchar(400) NOT NULL,
  "expected_outcome" varchar(400) NOT NULL,
  "status" varchar(20) NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "strategic_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "title" varchar(200) NOT NULL,
  "objective" varchar(400) NOT NULL,
  "description" text NOT NULL,
  "category" varchar(40) NOT NULL,
  "metric_key" varchar(80) NOT NULL,
  "baseline_value" numeric(18, 4),
  "target_value" numeric(18, 4),
  "target_date" timestamp with time zone NOT NULL,
  "owner_id" uuid,
  "status" varchar(20) NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "strategic_plan_milestones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "plan_id" uuid NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" varchar(400) NOT NULL,
  "due_date" timestamp with time zone,
  "status" varchar(20) NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "strategic_plan_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "plan_id" uuid NOT NULL,
  "event" varchar(40) NOT NULL,
  "from_status" varchar(20),
  "to_status" varchar(20),
  "actor_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "strategic_action_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "recommendation_id" uuid NOT NULL,
  "plan_id" uuid,
  "title" varchar(200) NOT NULL,
  "description" varchar(800) NOT NULL,
  "status" varchar(20) NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "strategic_action_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "action_plan_id" uuid NOT NULL,
  "position" integer NOT NULL,
  "title" varchar(240) NOT NULL,
  "description" varchar(800) NOT NULL,
  "action_type" varchar(40) NOT NULL,
  "status" varchar(30) NOT NULL,
  "approval_id" uuid,
  "execution_reference" varchar(80),
  "note" varchar(400),
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "business_goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" varchar(200) NOT NULL,
  "description" varchar(800) NOT NULL,
  "metric_key" varchar(80) NOT NULL,
  "metric_direction" varchar(10) NOT NULL,
  "baseline_value" numeric(18, 4),
  "current_value" numeric(18, 4),
  "target_value" numeric(18, 4) NOT NULL,
  "start_date" timestamp with time zone NOT NULL,
  "target_date" timestamp with time zone NOT NULL,
  "owner_id" uuid,
  "status" varchar(20) NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "business_goal_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "goal_id" uuid NOT NULL,
  "metric_value" numeric(18, 4),
  "snapshot_date" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "recommendation_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "recommendation_id" uuid NOT NULL,
  "user_id" uuid,
  "feedback_type" varchar(30) NOT NULL,
  "feedback_reason" varchar(400),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "strategic_recommendations" ADD CONSTRAINT "strategic_recommendations_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_plans" ADD CONSTRAINT "strategic_plans_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_plans" ADD CONSTRAINT "strategic_plans_owner_id_fk"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_plans" ADD CONSTRAINT "strategic_plans_created_by_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_plan_milestones" ADD CONSTRAINT "strategic_plan_milestones_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_plan_milestones" ADD CONSTRAINT "strategic_plan_milestones_plan_id_fk"
    FOREIGN KEY ("plan_id") REFERENCES "strategic_plans"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_plan_events" ADD CONSTRAINT "strategic_plan_events_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_plan_events" ADD CONSTRAINT "strategic_plan_events_plan_id_fk"
    FOREIGN KEY ("plan_id") REFERENCES "strategic_plans"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_plan_events" ADD CONSTRAINT "strategic_plan_events_actor_id_fk"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_action_plans" ADD CONSTRAINT "strategic_action_plans_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_action_plans" ADD CONSTRAINT "strategic_action_plans_recommendation_id_fk"
    FOREIGN KEY ("recommendation_id") REFERENCES "strategic_recommendations"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_action_plans" ADD CONSTRAINT "strategic_action_plans_plan_id_fk"
    FOREIGN KEY ("plan_id") REFERENCES "strategic_plans"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_action_plans" ADD CONSTRAINT "strategic_action_plans_created_by_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_action_steps" ADD CONSTRAINT "strategic_action_steps_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_action_steps" ADD CONSTRAINT "strategic_action_steps_action_plan_id_fk"
    FOREIGN KEY ("action_plan_id") REFERENCES "strategic_action_plans"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "business_goals" ADD CONSTRAINT "business_goals_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "business_goals" ADD CONSTRAINT "business_goals_owner_id_fk"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "business_goals" ADD CONSTRAINT "business_goals_created_by_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "business_goal_snapshots" ADD CONSTRAINT "business_goal_snapshots_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "business_goal_snapshots" ADD CONSTRAINT "business_goal_snapshots_goal_id_fk"
    FOREIGN KEY ("goal_id") REFERENCES "business_goals"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_recommendation_id_fk"
    FOREIGN KEY ("recommendation_id") REFERENCES "strategic_recommendations"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "strategic_recommendations" ADD CONSTRAINT "strategic_recommendations_status_check"
    CHECK ("status" IN ('open', 'accepted', 'rejected', 'expired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_plans" ADD CONSTRAINT "strategic_plans_status_check"
    CHECK ("status" IN ('DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_plan_milestones" ADD CONSTRAINT "strategic_plan_milestones_status_check"
    CHECK ("status" IN ('pending', 'completed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_action_plans" ADD CONSTRAINT "strategic_action_plans_status_check"
    CHECK ("status" IN ('ready', 'executing', 'completed', 'cancelled', 'failed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "strategic_action_steps" ADD CONSTRAINT "strategic_action_steps_status_check"
    CHECK ("status" IN ('pending', 'awaiting_approval', 'completed', 'failed', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "business_goals" ADD CONSTRAINT "business_goals_status_check"
    CHECK ("status" IN ('active', 'completed', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "business_goals" ADD CONSTRAINT "business_goals_direction_check"
    CHECK ("metric_direction" IN ('higher', 'lower'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_type_check"
    CHECK ("feedback_type" IN ('useful', 'not_useful', 'unclear'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "strategic_recommendations_key_unique"
  ON "strategic_recommendations" ("tenant_id", "recommendation_key");
CREATE INDEX IF NOT EXISTS "strategic_recommendations_tenant_idx"
  ON "strategic_recommendations" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "strategic_plans_tenant_idx"
  ON "strategic_plans" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "strategic_plan_milestones_plan_idx"
  ON "strategic_plan_milestones" ("tenant_id", "plan_id");
CREATE INDEX IF NOT EXISTS "strategic_plan_events_plan_idx"
  ON "strategic_plan_events" ("tenant_id", "plan_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "strategic_action_plans_recommendation_unique"
  ON "strategic_action_plans" ("tenant_id", "recommendation_id");
CREATE INDEX IF NOT EXISTS "strategic_action_plans_tenant_idx"
  ON "strategic_action_plans" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "strategic_action_steps_plan_idx"
  ON "strategic_action_steps" ("tenant_id", "action_plan_id");
CREATE INDEX IF NOT EXISTS "business_goals_tenant_idx"
  ON "business_goals" ("tenant_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "business_goal_snapshots_day_unique"
  ON "business_goal_snapshots" ("goal_id", "snapshot_date");
CREATE INDEX IF NOT EXISTS "business_goal_snapshots_tenant_idx"
  ON "business_goal_snapshots" ("tenant_id", "goal_id");
CREATE UNIQUE INDEX IF NOT EXISTS "recommendation_feedback_user_unique"
  ON "recommendation_feedback" ("recommendation_id", "user_id");
CREATE INDEX IF NOT EXISTS "recommendation_feedback_tenant_idx"
  ON "recommendation_feedback" ("tenant_id", "recommendation_id");
