CREATE TABLE IF NOT EXISTS "workflow_optimization_recommendations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "workflow_id" uuid,
  "recommendation_key" varchar(200) NOT NULL,
  "rule" varchar(40) NOT NULL,
  "title" varchar(200) NOT NULL,
  "evidence" varchar(800) NOT NULL,
  "suggestion" varchar(400) NOT NULL,
  "impact" varchar(300) NOT NULL,
  "status" varchar(20) NOT NULL,
  "metrics" jsonb NOT NULL,
  "period_start" timestamp with time zone,
  "period_end" timestamp with time zone,
  "detected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "workflow_optimization_recommendations" ADD CONSTRAINT "workflow_recommendations_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_optimization_recommendations" ADD CONSTRAINT "workflow_recommendations_workflow_id_fk"
    FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_optimization_recommendations" ADD CONSTRAINT "workflow_recommendations_status_check"
    CHECK ("status" IN ('open', 'reviewed', 'dismissed', 'applied'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_recommendations_key_unique"
  ON "workflow_optimization_recommendations" ("tenant_id", "recommendation_key");
CREATE INDEX IF NOT EXISTS "workflow_recommendations_tenant_status_idx"
  ON "workflow_optimization_recommendations" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "workflow_executions_tenant_started_idx"
  ON "workflow_executions" ("tenant_id", "started_at");
CREATE INDEX IF NOT EXISTS "workflow_execution_steps_tenant_action_idx"
  ON "workflow_execution_steps" ("tenant_id", "action_type");
