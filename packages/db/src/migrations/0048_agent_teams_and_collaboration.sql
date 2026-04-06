-- Agent Teams
CREATE TABLE IF NOT EXISTS "agent_teams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "lead_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "created_by_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "created_by_user_id" text,
  "status" text NOT NULL DEFAULT 'active',
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "agent_teams_company_status_idx" ON "agent_teams" ("company_id", "status");

-- Agent Team Members
CREATE TABLE IF NOT EXISTS "agent_team_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_id" uuid NOT NULL REFERENCES "agent_teams"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'member',
  "joined_at" timestamp with time zone NOT NULL DEFAULT now(),
  "removed_at" timestamp with time zone,
  "added_by_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "added_by_user_id" text
);
CREATE INDEX IF NOT EXISTS "agent_team_members_team_idx" ON "agent_team_members" ("team_id", "removed_at");
CREATE INDEX IF NOT EXISTS "agent_team_members_agent_idx" ON "agent_team_members" ("agent_id", "removed_at");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_team_members_unique_active" ON "agent_team_members" ("team_id", "agent_id") WHERE "removed_at" IS NULL;

-- Agent Messages
CREATE TABLE IF NOT EXISTS "agent_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "from_agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "to_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "to_team_id" uuid REFERENCES "agent_teams"("id") ON DELETE SET NULL,
  "thread_id" uuid,
  "parent_message_id" uuid REFERENCES "agent_messages"("id") ON DELETE SET NULL,
  "message_type" text NOT NULL DEFAULT 'chat',
  "subject" text,
  "body" text NOT NULL,
  "metadata" jsonb DEFAULT '{}',
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "agent_messages_to_agent_idx" ON "agent_messages" ("to_agent_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "agent_messages_to_team_idx" ON "agent_messages" ("to_team_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "agent_messages_thread_idx" ON "agent_messages" ("thread_id", "created_at");
CREATE INDEX IF NOT EXISTS "agent_messages_company_idx" ON "agent_messages" ("company_id", "created_at" DESC);

-- Team Tasks (Shared Task List)
CREATE TABLE IF NOT EXISTS "team_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_id" uuid NOT NULL REFERENCES "agent_teams"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "issue_id" uuid REFERENCES "issues"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'pending',
  "assigned_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "claimed_by_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "created_by_agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "priority" text NOT NULL DEFAULT 'medium',
  "depends_on_task_ids" uuid[] DEFAULT '{}',
  "metadata" jsonb DEFAULT '{}',
  "claimed_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "team_tasks_team_status_idx" ON "team_tasks" ("team_id", "status");
CREATE INDEX IF NOT EXISTS "team_tasks_assigned_idx" ON "team_tasks" ("assigned_agent_id", "status");

-- Agent Delegations
CREATE TABLE IF NOT EXISTS "agent_delegations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "from_agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "to_agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "issue_id" uuid REFERENCES "issues"("id") ON DELETE SET NULL,
  "team_task_id" uuid REFERENCES "team_tasks"("id") ON DELETE SET NULL,
  "delegation_type" text NOT NULL DEFAULT 'task',
  "status" text NOT NULL DEFAULT 'pending',
  "instructions" text NOT NULL,
  "result" text,
  "metadata" jsonb DEFAULT '{}',
  "accepted_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "agent_delegations_to_idx" ON "agent_delegations" ("to_agent_id", "status");
CREATE INDEX IF NOT EXISTS "agent_delegations_from_idx" ON "agent_delegations" ("from_agent_id", "status");
CREATE INDEX IF NOT EXISTS "agent_delegations_company_idx" ON "agent_delegations" ("company_id", "created_at" DESC);
