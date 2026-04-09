ALTER TABLE "provider_model_status"
ADD COLUMN IF NOT EXISTS "company_id" uuid REFERENCES "companies"("id");

ALTER TABLE "provider_model_status"
ADD COLUMN IF NOT EXISTS "auth_profile_key" text;

ALTER TABLE "provider_model_status"
ADD COLUMN IF NOT EXISTS "scope_key" text;

UPDATE "provider_model_status"
SET "scope_key" = 'global'
WHERE "scope_key" IS NULL;

ALTER TABLE "provider_model_status"
ALTER COLUMN "scope_key" SET NOT NULL;

ALTER TABLE "provider_model_status"
ALTER COLUMN "scope_key" SET DEFAULT 'global';

DROP INDEX IF EXISTS "provider_model_status_adapter_model_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "provider_model_status_adapter_model_scope_idx"
ON "provider_model_status" ("adapter_type", "model_id", "scope_key");

CREATE INDEX IF NOT EXISTS "provider_model_status_company_idx"
ON "provider_model_status" ("company_id");

CREATE INDEX IF NOT EXISTS "provider_model_status_scope_idx"
ON "provider_model_status" ("scope_key");
