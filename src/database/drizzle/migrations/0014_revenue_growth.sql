CREATE TABLE IF NOT EXISTS "growth_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "lead_quiet_days" integer DEFAULT 21 NOT NULL,
  "proposal_follow_up_days" integer DEFAULT 7 NOT NULL,
  "last_insufficient_leads" integer DEFAULT 0 NOT NULL,
  "last_truncated" boolean DEFAULT false NOT NULL,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "growth_opportunities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "lead_id" uuid,
  "prospect_id" uuid,
  "proposal_id" uuid,
  "signal_key" varchar(180) NOT NULL,
  "opportunity_type" varchar(40) NOT NULL,
  "title" varchar(180) NOT NULL,
  "description" varchar(800) NOT NULL,
  "evidence" varchar(800) NOT NULL,
  "explicit" boolean DEFAULT false NOT NULL,
  "source_type" varchar(40) NOT NULL,
  "source_id" uuid NOT NULL,
  "priority" varchar(20) NOT NULL,
  "priority_rank" integer NOT NULL,
  "priority_source" varchar(20) DEFAULT 'heuristic' NOT NULL,
  "confidence" varchar(20) NOT NULL,
  "status" varchar(30) DEFAULT 'identified' NOT NULL,
  "recommended_action" varchar(400) NOT NULL,
  "assigned_to" uuid,
  "task_id" uuid,
  "outcome" varchar(500),
  "reviewed_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "growth_opportunity_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "opportunity_id" uuid NOT NULL,
  "from_status" varchar(30),
  "to_status" varchar(30) NOT NULL,
  "note" varchar(400) NOT NULL,
  "actor_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "growth_action_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "opportunity_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "lead_id" uuid,
  "task_id" uuid,
  "objective" varchar(500) NOT NULL,
  "expected_outcome" varchar(500) NOT NULL,
  "actual_outcome" varchar(500),
  "priority" varchar(20) NOT NULL,
  "status" varchar(30) DEFAULT 'open' NOT NULL,
  "assigned_to" uuid,
  "due_at" timestamp with time zone,
  "created_by" uuid,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "growth_policies" ADD CONSTRAINT "growth_policies_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "growth_opportunities" ADD CONSTRAINT "growth_opportunities_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "growth_opportunities" ADD CONSTRAINT "growth_opportunities_company_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "growth_opportunities" ADD CONSTRAINT "growth_opportunities_lead_fk"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "growth_opportunities" ADD CONSTRAINT "growth_opportunities_prospect_fk"
    FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "growth_opportunities" ADD CONSTRAINT "growth_opportunities_proposal_fk"
    FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "growth_opportunity_events" ADD CONSTRAINT "growth_opportunity_events_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "growth_opportunity_events" ADD CONSTRAINT "growth_opportunity_events_opportunity_fk"
    FOREIGN KEY ("opportunity_id") REFERENCES "growth_opportunities"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "growth_action_plans" ADD CONSTRAINT "growth_action_plans_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "growth_action_plans" ADD CONSTRAINT "growth_action_plans_opportunity_fk"
    FOREIGN KEY ("opportunity_id") REFERENCES "growth_opportunities"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "growth_action_plans" ADD CONSTRAINT "growth_action_plans_company_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "growth_policies_tenant_unique" ON "growth_policies" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "growth_opportunities_key_unique" ON "growth_opportunities" ("tenant_id", "signal_key");
CREATE INDEX IF NOT EXISTS "growth_opportunities_status_idx" ON "growth_opportunities" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "growth_opportunity_events_idx" ON "growth_opportunity_events" ("tenant_id", "opportunity_id", "created_at");
CREATE INDEX IF NOT EXISTS "growth_action_plans_opportunity_idx" ON "growth_action_plans" ("tenant_id", "opportunity_id");

ALTER TABLE "workflows" DROP CONSTRAINT IF EXISTS "workflows_trigger_check";
DO $$ BEGIN
  ALTER TABLE "workflows" ADD CONSTRAINT "workflows_trigger_check"
    CHECK ("trigger_type" IN (
      'manual', 'scheduled', 'new_lead', 'task_overdue', 'proposal_expiring', 'approval_completed', 'exception_detected',
      'customer_conversation_started', 'customer_lead_created', 'customer_handoff', 'customer_complaint', 'customer_unresolved', 'customer_resolved',
      'customer_reply', 'proposal_sent', 'proposal_viewed', 'proposal_accepted', 'proposal_rejected', 'task_completed', 'human_handoff_requested', 'follow_up_due',
      'customer_at_risk', 'relationship_health_changed', 'customer_inactivity_detected', 'unanswered_message_detected',
      'customer_feedback_received', 'retention_plan_created', 'retention_action_completed',
      'growth_opportunity_identified', 'growth_priority_changed', 'growth_opportunity_assigned', 'growth_opportunity_qualified',
      'growth_opportunity_stalled', 'proposal_follow_up_required', 'customer_expansion_detected', 'lead_conversion_recommended',
      'growth_plan_created', 'growth_action_completed', 'growth_status_changed'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
