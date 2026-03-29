ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "routing_policy" jsonb;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "routing_enabled" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "routing_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "run_id" uuid NOT NULL,
  "agent_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "selected_adapter_type" text NOT NULL,
  "selected_model" text NOT NULL,
  "tier" smallint NOT NULL,
  "reasoning" text NOT NULL,
  "estimated_cost_usd" numeric(10,6),
  "complexity_score" numeric(3,2) NOT NULL,
  "alternatives_considered" jsonb NOT NULL DEFAULT '[]',
  "task_signals" jsonb NOT NULL DEFAULT '{}',
  "constraints_snapshot" jsonb NOT NULL DEFAULT '{}',
  "routing_latency_ms" integer NOT NULL,
  "is_failover" boolean NOT NULL DEFAULT false,
  "failover_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_routing_decisions_run" ON "routing_decisions" ("run_id");
CREATE INDEX IF NOT EXISTS "idx_routing_decisions_agent" ON "routing_decisions" ("agent_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_routing_decisions_company" ON "routing_decisions" ("company_id", "created_at" DESC);
