-- Phase 26: tenant role on users.
-- The earliest user in each tenant becomes the owner. Everyone else becomes a member.
-- Existing rows are preserved. Re-running this file is safe.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" varchar(20);

UPDATE "users" AS member
SET "role" = 'owner'
WHERE member."role" IS NULL
  AND member."id" = (
    SELECT earliest."id"
    FROM "users" AS earliest
    WHERE earliest."tenant_id" = member."tenant_id"
    ORDER BY earliest."created_at" ASC, earliest."id" ASC
    LIMIT 1
  );

UPDATE "users" SET "role" = 'member' WHERE "role" IS NULL;

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'member';
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_role_check"
    CHECK ("role" IN ('owner', 'admin', 'member'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "users_tenant_role_idx" ON "users" ("tenant_id", "role");
