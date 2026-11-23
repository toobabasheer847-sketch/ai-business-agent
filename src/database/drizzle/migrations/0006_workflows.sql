CREATE TABLE IF NOT EXISTS "workflows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "description" varchar(500) NOT NULL,
  "status" varchar(20) NOT NULL,
  "trigger_type" varchar(40) NOT NULL,
  "definition" jsonb NOT NULL,
  "version" integer NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "activated_at" timestamp with time zone,
  "paused_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "workflows" ADD CONSTRAINT "workflows_updated_by_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "workflows" ADD CONSTRAINT "workflows_status_check"
    CHECK ("status" IN ('draft', 'active', 'paused'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "workflows" ADD CONSTRAINT "workflows_trigger_check"
    CHECK ("trigger_type" IN ('manual', 'scheduled', 'new_lead', 'task_overdue', 'proposal_expiring', 'approval_completed', 'exception_detected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "workflows_tenant_status_idx" ON "workflows" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "workflows_tenant_trigger_idx" ON "workflows" ("tenant_id", "trigger_type");

CREATE TABLE IF NOT EXISTS "workflow_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "workflow_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "definition_snapshot" jsonb NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_fk"
    FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_created_by_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_versions_workflow_version_unique" ON "workflow_versions" ("workflow_id", "version");
CREATE INDEX IF NOT EXISTS "workflow_versions_tenant_idx" ON "workflow_versions" ("tenant_id", "workflow_id");

CREATE TABLE IF NOT EXISTS "workflow_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "workflow_id" uuid NOT NULL,
  "workflow_version" integer NOT NULL,
  "trigger_source" varchar(20) NOT NULL,
  "trigger_reference" varchar(160) NOT NULL,
  "status" varchar(30) NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "duration_ms" integer,
  "error_code" varchar(80),
  "sanitized_error" varchar(300),
  "execution_context" jsonb NOT NULL,
  "triggered_by" uuid,
  "definition_snapshot" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_fk"
    FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_triggered_by_fk"
    FOREIGN KEY ("triggered_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_status_check"
    CHECK ("status" IN ('queued', 'running', 'waiting_for_approval', 'completed', 'partially_completed', 'failed', 'cancelled', 'retrying'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_executions_trigger_unique"
  ON "workflow_executions" ("tenant_id", "workflow_id", "trigger_reference");
CREATE INDEX IF NOT EXISTS "workflow_executions_tenant_status_idx"
  ON "workflow_executions" ("tenant_id", "status", "started_at");
CREATE INDEX IF NOT EXISTS "workflow_executions_workflow_idx"
  ON "workflow_executions" ("workflow_id", "started_at");
CREATE INDEX IF NOT EXISTS "workflow_executions_waiting_idx"
  ON "workflow_executions" ("tenant_id", "started_at")
  WHERE "status" = 'waiting_for_approval';

CREATE TABLE IF NOT EXISTS "workflow_execution_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "execution_id" uuid NOT NULL,
  "step_key" varchar(40) NOT NULL,
  "action_type" varchar(60) NOT NULL,
  "status" varchar(30) NOT NULL,
  "input_snapshot" jsonb NOT NULL,
  "output_snapshot" jsonb NOT NULL,
  "approval_id" uuid,
  "attempt_count" integer NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "error_code" varchar(80),
  "sanitized_error" varchar(300),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "workflow_execution_steps" ADD CONSTRAINT "workflow_execution_steps_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_execution_steps" ADD CONSTRAINT "workflow_execution_steps_execution_id_fk"
    FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_execution_steps" ADD CONSTRAINT "workflow_execution_steps_approval_id_fk"
    FOREIGN KEY ("approval_id") REFERENCES "ai_approvals"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_execution_steps" ADD CONSTRAINT "workflow_execution_steps_status_check"
    CHECK ("status" IN ('pending', 'running', 'waiting_for_approval', 'completed', 'failed', 'skipped', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_execution_steps_key_unique"
  ON "workflow_execution_steps" ("execution_id", "step_key");
CREATE INDEX IF NOT EXISTS "workflow_execution_steps_tenant_idx"
  ON "workflow_execution_steps" ("tenant_id", "execution_id");
CREATE INDEX IF NOT EXISTS "workflow_execution_steps_approval_idx"
  ON "workflow_execution_steps" ("approval_id");

ALTER TABLE "operational_exceptions" DROP CONSTRAINT IF EXISTS "operational_exceptions_category_check";
ALTER TABLE "operational_exceptions" ADD CONSTRAINT "operational_exceptions_category_check"
  CHECK ("category" IN ('task', 'sales', 'proposal', 'communication', 'ai_automation', 'approval', 'workflow'));
