ALTER TABLE "model_routing_log"
ADD COLUMN IF NOT EXISTS "auth_profile_key" text;
