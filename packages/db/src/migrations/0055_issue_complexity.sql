ALTER TABLE "issues"
ADD COLUMN IF NOT EXISTS "complexity" text DEFAULT 'standard' NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_company_complexity_idx"
ON "issues" USING btree ("company_id","complexity");
