-- Phase 24: public proposal review links.
-- Idempotent. Existing proposal rows stay intact; only a nullable column is added.

ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "rejection_reason" text;

CREATE TABLE IF NOT EXISTS "proposal_access_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "proposal_access_tokens_token_hash_unique"
  ON "proposal_access_tokens" ("token_hash");

CREATE INDEX IF NOT EXISTS "proposal_access_tokens_tenant_id_idx"
  ON "proposal_access_tokens" ("tenant_id");

CREATE INDEX IF NOT EXISTS "proposal_access_tokens_proposal_id_idx"
  ON "proposal_access_tokens" ("proposal_id");

DO $$ BEGIN
  ALTER TABLE "proposal_access_tokens"
    ADD CONSTRAINT "proposal_access_tokens_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
    ON DELETE cascade ON UPDATE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "proposal_access_tokens"
    ADD CONSTRAINT "proposal_access_tokens_proposal_id_proposals_id_fk"
    FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id")
    ON DELETE cascade ON UPDATE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
