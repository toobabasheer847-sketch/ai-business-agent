CREATE TABLE IF NOT EXISTS "customer_ai_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "public_key" varchar(32) NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "display_name" varchar(80) NOT NULL,
  "welcome_message" varchar(400) NOT NULL,
  "instructions" varchar(1000) DEFAULT '' NOT NULL,
  "lead_capture_enabled" boolean DEFAULT false NOT NULL,
  "handoff_notifications_enabled" boolean DEFAULT true NOT NULL,
  "knowledge_base_id" uuid,
  "company_id" uuid,
  "collect_name" boolean DEFAULT true NOT NULL,
  "collect_email" boolean DEFAULT true NOT NULL,
  "collect_phone" boolean DEFAULT false NOT NULL,
  "accent" varchar(20) DEFAULT 'slate' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "customer_chat_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "ended_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "customer_ai_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "intent" varchar(40) NOT NULL,
  "confidence" varchar(20) NOT NULL,
  "intent_source" varchar(40) NOT NULL,
  "intent_evidence" varchar(400) NOT NULL,
  "handoff_reason" varchar(400),
  "handoff_at" timestamp with time zone,
  "lead_id" uuid,
  "assigned_user_id" uuid,
  "visitor_name" varchar(120),
  "visitor_email" varchar(255),
  "visitor_phone" varchar(50),
  "requirements" text,
  "summary" text NOT NULL,
  "status" varchar(20) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "customer_ai_settings" ADD CONSTRAINT "customer_ai_settings_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "customer_ai_settings" ADD CONSTRAINT "customer_ai_settings_knowledge_fk"
    FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledgebases"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "customer_ai_settings" ADD CONSTRAINT "customer_ai_settings_company_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "customer_chat_sessions" ADD CONSTRAINT "customer_chat_sessions_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "customer_chat_sessions" ADD CONSTRAINT "customer_chat_sessions_conversation_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "customer_ai_states" ADD CONSTRAINT "customer_ai_states_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "customer_ai_states" ADD CONSTRAINT "customer_ai_states_conversation_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "customer_ai_states" ADD CONSTRAINT "customer_ai_states_lead_fk"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "customer_ai_states" ADD CONSTRAINT "customer_ai_states_user_fk"
    FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "customer_ai_states" ADD CONSTRAINT "customer_ai_states_status_check"
    CHECK ("status" IN ('open', 'handoff', 'resolved'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "customer_ai_settings" ADD CONSTRAINT "customer_ai_settings_accent_check"
    CHECK ("accent" IN ('slate', 'blue', 'emerald'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "customer_ai_settings_tenant_unique" ON "customer_ai_settings" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "customer_ai_settings_public_key_unique" ON "customer_ai_settings" ("public_key");
CREATE UNIQUE INDEX IF NOT EXISTS "customer_chat_sessions_token_unique" ON "customer_chat_sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "customer_chat_sessions_conversation_idx" ON "customer_chat_sessions" ("tenant_id", "conversation_id");
CREATE UNIQUE INDEX IF NOT EXISTS "customer_ai_states_conversation_unique" ON "customer_ai_states" ("conversation_id");
CREATE INDEX IF NOT EXISTS "customer_ai_states_tenant_idx" ON "customer_ai_states" ("tenant_id", "status", "updated_at");

ALTER TABLE "workflows" DROP CONSTRAINT IF EXISTS "workflows_trigger_check";
DO $$ BEGIN
  ALTER TABLE "workflows" ADD CONSTRAINT "workflows_trigger_check"
    CHECK ("trigger_type" IN (
      'manual', 'scheduled', 'new_lead', 'task_overdue', 'proposal_expiring', 'approval_completed', 'exception_detected',
      'customer_conversation_started', 'customer_lead_created', 'customer_handoff', 'customer_complaint', 'customer_unresolved', 'customer_resolved'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
