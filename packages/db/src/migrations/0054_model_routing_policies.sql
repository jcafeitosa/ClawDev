CREATE TABLE "model_routing_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "agent_id" uuid,
  "role" text,
  "complexity" text DEFAULT 'any' NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "routing_strategy" text DEFAULT 'pinned' NOT NULL,
  "default_adapter_type" text,
  "default_model_id" text,
  "fallback_chain" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "allow_cross_provider_fallback" boolean DEFAULT true NOT NULL,
  "prefer_free_models" boolean DEFAULT false NOT NULL,
  "prefer_local_models" boolean DEFAULT false NOT NULL,
  "max_cost_per_request_micro" integer,
  "required_capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "min_context_window" integer,
  "max_latency_ms" integer,
  "priority" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "model_routing_policies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "model_routing_policies_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "model_routing_policies_company_priority_idx" ON "model_routing_policies" USING btree ("company_id","priority");
--> statement-breakpoint
CREATE INDEX "model_routing_policies_company_agent_idx" ON "model_routing_policies" USING btree ("company_id","agent_id");
--> statement-breakpoint
CREATE INDEX "model_routing_policies_company_role_complexity_idx" ON "model_routing_policies" USING btree ("company_id","role","complexity");
--> statement-breakpoint
CREATE UNIQUE INDEX "model_routing_policies_company_name_uniq" ON "model_routing_policies" USING btree ("company_id","name");
