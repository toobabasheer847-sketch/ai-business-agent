ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "lead_id" uuid;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "company_id" uuid;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "assigned_user_id" uuid;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "external_address" varchar(255);

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "direction" varchar(20);
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "delivery_status" varchar(30);
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "provider" varchar(40);
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "provider_message_id" varchar(128);
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "channel" varchar(30);
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "purpose" varchar(40);
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "author_kind" varchar(20);
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "error_code" varchar(80);
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "error_detail" varchar(400);

DO $$ BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_fk"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_company_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_user_fk"
    FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "conversations_tenant_channel_address_idx" ON "conversations" ("tenant_id", "channel", "external_address");
CREATE INDEX IF NOT EXISTS "conversations_tenant_lead_idx" ON "conversations" ("tenant_id", "lead_id");
CREATE INDEX IF NOT EXISTS "conversations_tenant_assigned_idx" ON "conversations" ("tenant_id", "assigned_user_id");
CREATE INDEX IF NOT EXISTS "messages_tenant_provider_message_idx" ON "messages" ("tenant_id", "provider", "provider_message_id");

CREATE TABLE IF NOT EXISTS "communication_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "subject_type" varchar(20) NOT NULL,
  "subject_id" uuid NOT NULL,
  "preferred_channel" varchar(20),
  "email_status" varchar(20) DEFAULT 'unknown' NOT NULL,
  "sms_status" varchar(20) DEFAULT 'unknown' NOT NULL,
  "whatsapp_status" varchar(20) DEFAULT 'unknown' NOT NULL,
  "marketing_consent" varchar(20) DEFAULT 'unknown' NOT NULL,
  "marketing_consent_source" varchar(120),
  "marketing_consent_at" timestamp with time zone,
  "marketing_opt_out_at" timestamp with time zone,
  "marketing_evidence" varchar(500),
  "customer_requested_at" timestamp with time zone,
  "restrictions" varchar(500),
  "email" varchar(255),
  "phone" varchar(50),
  "whatsapp" varchar(50),
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "communication_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" varchar(120) NOT NULL,
  "channel" varchar(20) NOT NULL,
  "purpose" varchar(40) NOT NULL,
  "content" text NOT NULL,
  "variables" jsonb NOT NULL,
  "approval_status" varchar(20) DEFAULT 'draft' NOT NULL,
  "provider_template_ref" varchar(120),
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "communication_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "description" varchar(500) DEFAULT '' NOT NULL,
  "channel" varchar(20) NOT NULL,
  "purpose" varchar(40) NOT NULL,
  "template_id" uuid,
  "audience" jsonb NOT NULL,
  "status" varchar(20) NOT NULL,
  "scheduled_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "approval_id" uuid,
  "failure_reason" varchar(300),
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "communication_campaign_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "subject_type" varchar(20) NOT NULL,
  "subject_id" uuid NOT NULL,
  "recipient" varchar(255) NOT NULL,
  "status" varchar(30) NOT NULL,
  "dispatch_id" uuid,
  "error_code" varchar(80),
  "idempotency_key" varchar(160) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "communication_dispatches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "message_id" uuid,
  "conversation_id" uuid,
  "lead_id" uuid,
  "prospect_id" uuid,
  "company_id" uuid,
  "channel" varchar(20) NOT NULL,
  "provider" varchar(40),
  "purpose" varchar(40) NOT NULL,
  "status" varchar(30) NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "idempotency_key" varchar(160) NOT NULL,
  "provider_message_id" varchar(128),
  "permanent_failure" boolean DEFAULT false NOT NULL,
  "error_code" varchar(80),
  "error_detail" varchar(400),
  "approval_id" uuid,
  "recipient" varchar(255) NOT NULL,
  "subject" varchar(200),
  "body" text NOT NULL,
  "from_phone_number_id" uuid,
  "from_email" varchar(255),
  "provider_template_ref" varchar(120),
  "author_kind" varchar(20) DEFAULT 'human' NOT NULL,
  "campaign_id" uuid,
  "queued_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "read_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "provider_webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid,
  "provider" varchar(40) NOT NULL,
  "event_id" varchar(180) NOT NULL,
  "payload_hash" varchar(64) NOT NULL,
  "status" varchar(20) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "whatsapp_channel_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "provider" varchar(40) DEFAULT 'meta_cloud' NOT NULL,
  "phone_number_id" varchar(64),
  "business_account_id" varchar(64),
  "access_token_encrypted" text,
  "app_secret_encrypted" text,
  "verify_token_hash" varchar(64),
  "status" varchar(40) DEFAULT 'not_configured' NOT NULL,
  "live_verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "communication_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "quiet_start_hour" integer,
  "quiet_end_hour" integer,
  "time_zone" varchar(80) DEFAULT 'UTC' NOT NULL,
  "max_automated_follow_ups" integer DEFAULT 3 NOT NULL,
  "follow_up_delay_minutes" integer,
  "opt_out_confirmation_enabled" boolean DEFAULT false NOT NULL,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "communication_preferences" ADD CONSTRAINT "communication_preferences_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "communication_campaigns" ADD CONSTRAINT "communication_campaigns_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "communication_campaigns" ADD CONSTRAINT "communication_campaigns_template_fk"
    FOREIGN KEY ("template_id") REFERENCES "communication_templates"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "communication_campaign_recipients" ADD CONSTRAINT "communication_campaign_recipients_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "communication_campaign_recipients" ADD CONSTRAINT "communication_campaign_recipients_campaign_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "communication_campaigns"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "communication_dispatches" ADD CONSTRAINT "communication_dispatches_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "communication_dispatches" ADD CONSTRAINT "communication_dispatches_message_fk"
    FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "communication_dispatches" ADD CONSTRAINT "communication_dispatches_conversation_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "provider_webhook_events" ADD CONSTRAINT "provider_webhook_events_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "whatsapp_channel_configs" ADD CONSTRAINT "whatsapp_channel_configs_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "communication_policies" ADD CONSTRAINT "communication_policies_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "communication_preferences_subject_unique"
  ON "communication_preferences" ("tenant_id", "subject_type", "subject_id");
CREATE INDEX IF NOT EXISTS "communication_preferences_email_idx" ON "communication_preferences" ("tenant_id", "email");
CREATE INDEX IF NOT EXISTS "communication_preferences_phone_idx" ON "communication_preferences" ("tenant_id", "phone");
CREATE INDEX IF NOT EXISTS "communication_templates_tenant_channel_idx" ON "communication_templates" ("tenant_id", "channel");
CREATE INDEX IF NOT EXISTS "communication_campaigns_tenant_status_idx" ON "communication_campaigns" ("tenant_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "communication_campaign_recipients_key_unique"
  ON "communication_campaign_recipients" ("tenant_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "communication_campaign_recipients_campaign_idx"
  ON "communication_campaign_recipients" ("campaign_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "communication_dispatches_key_unique"
  ON "communication_dispatches" ("tenant_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "communication_dispatches_tenant_status_idx" ON "communication_dispatches" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "communication_dispatches_provider_message_idx"
  ON "communication_dispatches" ("tenant_id", "provider", "provider_message_id");
CREATE UNIQUE INDEX IF NOT EXISTS "provider_webhook_events_event_unique"
  ON "provider_webhook_events" ("provider", "event_id");
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_channel_configs_tenant_unique" ON "whatsapp_channel_configs" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "communication_policies_tenant_unique" ON "communication_policies" ("tenant_id");

ALTER TABLE "workflows" DROP CONSTRAINT IF EXISTS "workflows_trigger_check";
DO $$ BEGIN
  ALTER TABLE "workflows" ADD CONSTRAINT "workflows_trigger_check"
    CHECK ("trigger_type" IN (
      'manual', 'scheduled', 'new_lead', 'task_overdue', 'proposal_expiring', 'approval_completed', 'exception_detected',
      'customer_conversation_started', 'customer_lead_created', 'customer_handoff', 'customer_complaint', 'customer_unresolved', 'customer_resolved',
      'customer_reply', 'proposal_sent', 'proposal_viewed', 'proposal_accepted', 'proposal_rejected', 'task_completed', 'human_handoff_requested', 'follow_up_due'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
