CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "agent_name" varchar(80) NOT NULL,
  "correlation_id" uuid NOT NULL,
  "parent_run_id" uuid,
  "provider_execution_id" uuid NOT NULL,
  "provider" varchar(40) NOT NULL,
  "model" varchar(120) NOT NULL,
  "status" varchar(20) NOT NULL,
  "usage_status" varchar(40) NOT NULL,
  "usage_note" varchar(200),
  "input_tokens" integer,
  "output_tokens" integer,
  "total_tokens" integer,
  "cost_status" varchar(40) NOT NULL,
  "estimated_input_cost" numeric(18, 8),
  "estimated_output_cost" numeric(18, 8),
  "estimated_total_cost" numeric(18, 8),
  "currency" varchar(8),
  "pricing_source" text,
  "pricing_effective_date" varchar(10),
  "duration_ms" integer,
  "started_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "error_code" varchar(80),
  "error_summary" varchar(300),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "agent_runs"
    ADD CONSTRAINT "agent_runs_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "agent_runs"
    ADD CONSTRAINT "agent_runs_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "agent_runs"
    ADD CONSTRAINT "agent_runs_parent_run_id_fk"
    FOREIGN KEY ("parent_run_id") REFERENCES "agent_runs"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "agent_runs"
    ADD CONSTRAINT "agent_runs_status_check"
    CHECK ("status" IN ('running', 'completed', 'failed'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "agent_runs"
    ADD CONSTRAINT "agent_runs_usage_status_check"
    CHECK ("usage_status" IN ('reported', 'unavailable'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "agent_runs"
    ADD CONSTRAINT "agent_runs_cost_status_check"
    CHECK ("cost_status" IN ('estimated', 'pricing_not_configured', 'usage_unavailable'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "agent_runs_provider_execution_id_unique" ON "agent_runs" ("provider_execution_id");
CREATE INDEX IF NOT EXISTS "agent_runs_tenant_started_idx" ON "agent_runs" ("tenant_id", "started_at");
CREATE INDEX IF NOT EXISTS "agent_runs_tenant_user_started_idx" ON "agent_runs" ("tenant_id", "user_id", "started_at");
CREATE INDEX IF NOT EXISTS "agent_runs_tenant_agent_idx" ON "agent_runs" ("tenant_id", "agent_name");
CREATE INDEX IF NOT EXISTS "agent_runs_tenant_status_idx" ON "agent_runs" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "agent_runs_correlation_idx" ON "agent_runs" ("correlation_id");
