CREATE TABLE IF NOT EXISTS "provider_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies" ("id"),
  "adapter_type" varchar(64) NOT NULL,
  "display_name" varchar(128) NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "priority" integer NOT NULL DEFAULT 0,
  "auth_method" varchar(32) NOT NULL DEFAULT 'none',
  "credential_secret_id" uuid,
  "subscription_plan" varchar(64),
  "subscription_limit_monthly" integer,
  "subscription_resets_at" timestamp with time zone,
  "last_health_check" timestamp with time zone,
  "last_health_status" varchar(32),
  "last_health_detail" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "provider_configs_company_adapter_unique_idx"
  ON "provider_configs" ("company_id", "adapter_type");

CREATE TABLE IF NOT EXISTS "provider_health_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies" ("id"),
  "adapter_type" varchar(64) NOT NULL,
  "status" varchar(32) NOT NULL,
  "detail" text,
  "occurred_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "provider_health_events_company_adapter_occurred_idx"
  ON "provider_health_events" ("company_id", "adapter_type", "occurred_at" DESC);
