CREATE TABLE IF NOT EXISTS "operational_exceptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "exception_key" varchar(160) NOT NULL,
  "category" varchar(40) NOT NULL,
  "severity" varchar(20) NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" varchar(500) NOT NULL,
  "source_type" varchar(40) NOT NULL,
  "source_id" varchar(80) NOT NULL,
  "status" varchar(20) NOT NULL,
  "detected_at" timestamp with time zone NOT NULL,
  "last_detected_at" timestamp with time zone NOT NULL,
  "occurrence_count" integer NOT NULL,
  "priority_score" integer NOT NULL,
  "priority_reason" varchar(300) NOT NULL,
  "recommended_action" varchar(300) NOT NULL,
  "recommended_action_type" varchar(40) NOT NULL,
  "assigned_to" uuid,
  "acknowledged_at" timestamp with time zone,
  "acknowledged_by" uuid,
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid,
  "dismissed_at" timestamp with time zone,
  "dismissed_by" uuid,
  "resolution_note" varchar(500),
  "metadata" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "operational_exceptions"
    ADD CONSTRAINT "operational_exceptions_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "operational_exceptions"
    ADD CONSTRAINT "operational_exceptions_assigned_to_fk"
    FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "operational_exceptions"
    ADD CONSTRAINT "operational_exceptions_acknowledged_by_fk"
    FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "operational_exceptions"
    ADD CONSTRAINT "operational_exceptions_resolved_by_fk"
    FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "operational_exceptions"
    ADD CONSTRAINT "operational_exceptions_dismissed_by_fk"
    FOREIGN KEY ("dismissed_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "operational_exceptions"
    ADD CONSTRAINT "operational_exceptions_category_check"
    CHECK ("category" IN ('task', 'sales', 'proposal', 'communication', 'ai_automation', 'approval', 'workflow'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "operational_exceptions"
    ADD CONSTRAINT "operational_exceptions_severity_check"
    CHECK ("severity" IN ('critical', 'high', 'medium', 'low'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "operational_exceptions"
    ADD CONSTRAINT "operational_exceptions_status_check"
    CHECK ("status" IN ('open', 'acknowledged', 'in_progress', 'resolved', 'dismissed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "operational_exceptions_tenant_key_unique"
  ON "operational_exceptions" ("tenant_id", "exception_key");
CREATE INDEX IF NOT EXISTS "operational_exceptions_tenant_status_idx"
  ON "operational_exceptions" ("tenant_id", "status", "priority_score");
CREATE INDEX IF NOT EXISTS "operational_exceptions_tenant_category_idx"
  ON "operational_exceptions" ("tenant_id", "category");
CREATE INDEX IF NOT EXISTS "operational_exceptions_source_idx"
  ON "operational_exceptions" ("tenant_id", "source_type", "source_id");
CREATE INDEX IF NOT EXISTS "operational_exceptions_open_idx"
  ON "operational_exceptions" ("tenant_id", "last_detected_at")
  WHERE "status" IN ('open', 'acknowledged', 'in_progress');

CREATE TABLE IF NOT EXISTS "exception_scans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "trigger" varchar(20) NOT NULL,
  "status" varchar(20) NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "finished_at" timestamp with time zone NOT NULL,
  "created_count" integer NOT NULL,
  "updated_count" integer NOT NULL,
  "resolved_count" integer NOT NULL,
  "error_summary" varchar(300),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "exception_scans"
    ADD CONSTRAINT "exception_scans_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "exception_scans_tenant_started_idx"
  ON "exception_scans" ("tenant_id", "started_at");
