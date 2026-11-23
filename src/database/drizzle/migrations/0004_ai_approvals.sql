CREATE TABLE IF NOT EXISTS "ai_approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "requester_user_id" uuid,
  "approver_user_id" uuid,
  "agent_run_id" uuid,
  "agent_name" varchar(80),
  "action_type" varchar(80) NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" varchar(500) NOT NULL,
  "target_entity_type" varchar(80) NOT NULL,
  "target_entity_id" varchar(80) NOT NULL,
  "proposed_payload" jsonb NOT NULL,
  "original_payload" jsonb NOT NULL,
  "approved_payload" jsonb,
  "status" varchar(20) NOT NULL,
  "risk_level" varchar(20) NOT NULL,
  "reason" varchar(300) NOT NULL,
  "rejection_reason" varchar(500),
  "payload_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "decided_at" timestamp with time zone,
  "executed_at" timestamp with time zone,
  "execution_reference" varchar(200),
  "error_summary" varchar(300),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "ai_approvals"
    ADD CONSTRAINT "ai_approvals_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_approvals"
    ADD CONSTRAINT "ai_approvals_requester_user_id_fk"
    FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_approvals"
    ADD CONSTRAINT "ai_approvals_approver_user_id_fk"
    FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_approvals"
    ADD CONSTRAINT "ai_approvals_agent_run_id_fk"
    FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_approvals"
    ADD CONSTRAINT "ai_approvals_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected', 'executing', 'executed', 'failed', 'expired', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_approvals"
    ADD CONSTRAINT "ai_approvals_risk_level_check"
    CHECK ("risk_level" IN ('low', 'medium', 'high'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ai_approvals_pending_target_unique"
  ON "ai_approvals" ("tenant_id", "action_type", "target_entity_id", "payload_hash")
  WHERE "status" = 'pending';
CREATE INDEX IF NOT EXISTS "ai_approvals_tenant_status_created_idx"
  ON "ai_approvals" ("tenant_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "ai_approvals_tenant_requester_idx"
  ON "ai_approvals" ("tenant_id", "requester_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_approvals_tenant_action_idx"
  ON "ai_approvals" ("tenant_id", "action_type");
CREATE INDEX IF NOT EXISTS "ai_approvals_tenant_risk_idx"
  ON "ai_approvals" ("tenant_id", "risk_level");

CREATE TABLE IF NOT EXISTS "ai_approval_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "approval_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "actor_user_id" uuid,
  "event_type" varchar(40) NOT NULL,
  "note" varchar(500),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "ai_approval_events"
    ADD CONSTRAINT "ai_approval_events_approval_id_fk"
    FOREIGN KEY ("approval_id") REFERENCES "ai_approvals"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_approval_events"
    ADD CONSTRAINT "ai_approval_events_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_approval_events"
    ADD CONSTRAINT "ai_approval_events_actor_user_id_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ai_approval_events_approval_idx"
  ON "ai_approval_events" ("approval_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_approval_events_tenant_idx"
  ON "ai_approval_events" ("tenant_id", "created_at");
