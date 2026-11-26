CREATE TABLE IF NOT EXISTS "retention_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "inactivity_days" integer DEFAULT 30 NOT NULL,
  "unanswered_days" integer DEFAULT 3 NOT NULL,
  "stalled_proposal_days" integer DEFAULT 14 NOT NULL,
  "unresolved_conversation_days" integer DEFAULT 7 NOT NULL,
  "follow_up_due_days" integer DEFAULT 2 NOT NULL,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "retention_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "classification" varchar(30) NOT NULL,
  "confidence" varchar(20) NOT NULL,
  "data_sufficiency" varchar(20) NOT NULL,
  "explanation" varchar(800) NOT NULL,
  "signal_fingerprint" varchar(2000) DEFAULT '' NOT NULL,
  "signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "last_interaction_at" timestamp with time zone,
  "assessed_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "retention_assessments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "classification" varchar(30) NOT NULL,
  "confidence" varchar(20) NOT NULL,
  "data_sufficiency" varchar(20) NOT NULL,
  "explanation" varchar(800) NOT NULL,
  "signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "assessed_at" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "retention_recommendations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "signal_key" varchar(180) NOT NULL,
  "title" varchar(180) NOT NULL,
  "explanation" varchar(800) NOT NULL,
  "action" varchar(500) NOT NULL,
  "priority" varchar(20) NOT NULL,
  "confidence" varchar(20) NOT NULL,
  "status" varchar(30) DEFAULT 'open' NOT NULL,
  "source_type" varchar(40) NOT NULL,
  "source_id" uuid NOT NULL,
  "evidence" varchar(800) NOT NULL,
  "assigned_user_id" uuid,
  "task_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "retention_action_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "recommendation_id" uuid,
  "task_id" uuid,
  "title" varchar(180) NOT NULL,
  "objective" varchar(500) NOT NULL,
  "issue" varchar(500) NOT NULL,
  "priority" varchar(20) NOT NULL,
  "status" varchar(30) DEFAULT 'open' NOT NULL,
  "assigned_user_id" uuid,
  "due_at" timestamp with time zone,
  "evidence" varchar(800) DEFAULT '' NOT NULL,
  "expected_outcome" varchar(500) NOT NULL,
  "actual_outcome" varchar(500),
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "retention_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "message_id" uuid NOT NULL,
  "polarity" varchar(40) NOT NULL,
  "excerpt" varchar(200) NOT NULL,
  "method" varchar(40) DEFAULT 'explicit_phrase' NOT NULL,
  "review_status" varchar(30) DEFAULT 'unreviewed' NOT NULL,
  "observed_at" timestamp with time zone NOT NULL,
  "reviewed_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "retention_accounts" ADD CONSTRAINT "retention_accounts_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "retention_accounts" ADD CONSTRAINT "retention_accounts_company_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "retention_assessments" ADD CONSTRAINT "retention_assessments_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "retention_assessments" ADD CONSTRAINT "retention_assessments_company_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "retention_recommendations" ADD CONSTRAINT "retention_recommendations_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "retention_recommendations" ADD CONSTRAINT "retention_recommendations_company_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "retention_action_plans" ADD CONSTRAINT "retention_action_plans_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "retention_action_plans" ADD CONSTRAINT "retention_action_plans_company_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "retention_feedback" ADD CONSTRAINT "retention_feedback_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "retention_feedback" ADD CONSTRAINT "retention_feedback_company_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "retention_policies_tenant_unique" ON "retention_policies" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "retention_accounts_company_unique" ON "retention_accounts" ("tenant_id", "company_id");
CREATE INDEX IF NOT EXISTS "retention_accounts_class_idx" ON "retention_accounts" ("tenant_id", "classification");
CREATE INDEX IF NOT EXISTS "retention_assessments_company_idx" ON "retention_assessments" ("tenant_id", "company_id", "assessed_at");
CREATE UNIQUE INDEX IF NOT EXISTS "retention_recommendations_key_unique" ON "retention_recommendations" ("tenant_id", "signal_key");
CREATE INDEX IF NOT EXISTS "retention_recommendations_status_idx" ON "retention_recommendations" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "retention_action_plans_company_idx" ON "retention_action_plans" ("tenant_id", "company_id");
CREATE UNIQUE INDEX IF NOT EXISTS "retention_feedback_message_unique" ON "retention_feedback" ("tenant_id", "message_id");

ALTER TABLE "workflows" DROP CONSTRAINT IF EXISTS "workflows_trigger_check";
DO $$ BEGIN
  ALTER TABLE "workflows" ADD CONSTRAINT "workflows_trigger_check"
    CHECK ("trigger_type" IN (
      'manual', 'scheduled', 'new_lead', 'task_overdue', 'proposal_expiring', 'approval_completed', 'exception_detected',
      'customer_conversation_started', 'customer_lead_created', 'customer_handoff', 'customer_complaint', 'customer_unresolved', 'customer_resolved',
      'customer_reply', 'proposal_sent', 'proposal_viewed', 'proposal_accepted', 'proposal_rejected', 'task_completed', 'human_handoff_requested', 'follow_up_due',
      'customer_at_risk', 'relationship_health_changed', 'customer_inactivity_detected', 'unanswered_message_detected',
      'customer_feedback_received', 'retention_plan_created', 'retention_action_completed'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
