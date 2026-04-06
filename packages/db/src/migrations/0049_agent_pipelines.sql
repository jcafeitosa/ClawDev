-- Agent Pipelines & Pipeline Executions
-- Sprint 3: Multi-agent pipeline orchestration

CREATE TABLE IF NOT EXISTS "agent_pipelines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "team_id" uuid REFERENCES "agent_teams"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "description" text,
  "steps" jsonb NOT NULL DEFAULT '[]',
  "trigger_type" text NOT NULL DEFAULT 'manual',
  "status" text NOT NULL DEFAULT 'draft',
  "created_by_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "created_by_user_id" text,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agent_pipelines_company_idx" ON "agent_pipelines" ("company_id", "status");
CREATE INDEX IF NOT EXISTS "agent_pipelines_team_idx" ON "agent_pipelines" ("team_id");

CREATE TABLE IF NOT EXISTS "pipeline_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pipeline_id" uuid NOT NULL REFERENCES "agent_pipelines"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "issue_id" uuid REFERENCES "issues"("id") ON DELETE SET NULL,
  "triggered_by_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "triggered_by_user_id" text,
  "status" text NOT NULL DEFAULT 'running',
  "current_step" integer NOT NULL DEFAULT 0,
  "step_results" jsonb NOT NULL DEFAULT '[]',
  "context" jsonb DEFAULT '{}',
  "error" text,
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "pipeline_executions_pipeline_idx" ON "pipeline_executions" ("pipeline_id", "status");
CREATE INDEX IF NOT EXISTS "pipeline_executions_company_idx" ON "pipeline_executions" ("company_id", "started_at");
