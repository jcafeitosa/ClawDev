-- Sprint 4: Knowledge, Deliberation, Templates, Expertise
-- Agent deliberations (debate/voting), templates, team knowledge base

CREATE TABLE IF NOT EXISTS "agent_deliberations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "team_id" uuid REFERENCES "agent_teams"("id") ON DELETE SET NULL,
  "issue_id" uuid REFERENCES "issues"("id") ON DELETE SET NULL,
  "topic" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'open',
  "decision_type" text NOT NULL DEFAULT 'majority_vote',
  "deadline" timestamp with time zone,
  "decision" text,
  "decided_at" timestamp with time zone,
  "created_by_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "created_by_user_id" text,
  "participant_agent_ids" uuid[] NOT NULL DEFAULT '{}',
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agent_deliberations_company_idx" ON "agent_deliberations" ("company_id", "status");
CREATE INDEX IF NOT EXISTS "agent_deliberations_team_idx" ON "agent_deliberations" ("team_id");

CREATE TABLE IF NOT EXISTS "agent_deliberation_votes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "deliberation_id" uuid NOT NULL REFERENCES "agent_deliberations"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "position" text NOT NULL DEFAULT 'abstain',
  "reasoning" text NOT NULL,
  "weight" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE("deliberation_id", "agent_id")
);

CREATE INDEX IF NOT EXISTS "delib_votes_deliberation_idx" ON "agent_deliberation_votes" ("deliberation_id");

CREATE TABLE IF NOT EXISTS "agent_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "base_config" jsonb NOT NULL DEFAULT '{}',
  "is_public" boolean NOT NULL DEFAULT false,
  "created_by_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "created_by_user_id" text,
  "usage_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agent_templates_company_idx" ON "agent_templates" ("company_id");

CREATE TABLE IF NOT EXISTS "team_knowledge" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_id" uuid NOT NULL REFERENCES "agent_teams"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "tags" text[] NOT NULL DEFAULT '{}',
  "author_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "superseded_by_id" uuid REFERENCES "team_knowledge"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "team_knowledge_team_idx" ON "team_knowledge" ("team_id");
CREATE INDEX IF NOT EXISTS "team_knowledge_tags_idx" ON "team_knowledge" USING gin ("tags");
