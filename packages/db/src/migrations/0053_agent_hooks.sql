-- 0053_agent_hooks.sql
-- Agent lifecycle hooks system: definitions, execution logs, and reusable templates

-- 1. Hook definitions per agent
CREATE TABLE agent_hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  event TEXT NOT NULL,
  hook_type TEXT NOT NULL DEFAULT 'webhook',
  config JSONB NOT NULL DEFAULT '{}',
  conditions JSONB DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  run_async BOOLEAN NOT NULL DEFAULT true,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  retry_count INTEGER NOT NULL DEFAULT 0,
  retry_delay_ms INTEGER NOT NULL DEFAULT 5000,
  created_by_agent_id UUID REFERENCES agents(id),
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_hooks_company ON agent_hooks(company_id);
CREATE INDEX idx_agent_hooks_agent ON agent_hooks(agent_id);
CREATE INDEX idx_agent_hooks_agent_event ON agent_hooks(agent_id, event) WHERE enabled = true;
CREATE INDEX idx_agent_hooks_company_event ON agent_hooks(company_id, event) WHERE enabled = true;

-- 2. Execution log for hook invocations
CREATE TABLE agent_hook_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hook_id UUID NOT NULL REFERENCES agent_hooks(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  event TEXT NOT NULL,
  event_payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  duration_ms INTEGER,
  triggered_by_run_id UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_hook_runs_hook ON agent_hook_runs(hook_id);
CREATE INDEX idx_agent_hook_runs_agent ON agent_hook_runs(agent_id);
CREATE INDEX idx_agent_hook_runs_status ON agent_hook_runs(status) WHERE status IN ('pending', 'running');

-- 3. Reusable hook templates at company level
CREATE TABLE company_hook_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT,
  event TEXT NOT NULL,
  hook_type TEXT NOT NULL DEFAULT 'webhook',
  config JSONB NOT NULL DEFAULT '{}',
  conditions JSONB DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_hook_templates_company ON company_hook_templates(company_id);
CREATE UNIQUE INDEX idx_company_hook_templates_name ON company_hook_templates(company_id, name);
