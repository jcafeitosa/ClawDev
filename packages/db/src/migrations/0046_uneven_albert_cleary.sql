CREATE TABLE "company_model_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"default_adapter_type" text,
	"default_model_id" text,
	"fallback_chain" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"routing_strategy" text DEFAULT 'pinned' NOT NULL,
	"allow_cross_provider_fallback" boolean DEFAULT true NOT NULL,
	"prefer_free_models" boolean DEFAULT false NOT NULL,
	"prefer_local_models" boolean DEFAULT false NOT NULL,
	"max_cost_per_request_micro" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adapter_type" text NOT NULL,
	"model_id" text NOT NULL,
	"label" text NOT NULL,
	"provider" text NOT NULL,
	"family" text,
	"tier" text DEFAULT 'paid' NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context_window" integer,
	"max_output_tokens" integer,
	"input_price_micro" integer DEFAULT 0 NOT NULL,
	"output_price_micro" integer DEFAULT 0 NOT NULL,
	"cached_input_price_micro" integer DEFAULT 0 NOT NULL,
	"rpm_limit" integer,
	"tpm_limit" integer,
	"deprecated_at" timestamp with time zone,
	"sunset_at" timestamp with time zone,
	"upgrade_path" text,
	"source" text DEFAULT 'static' NOT NULL,
	"is_local" boolean DEFAULT false NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"free_quota_detail" text,
	"last_probed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_routing_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid,
	"heartbeat_run_id" uuid,
	"requested_model_id" text,
	"requested_adapter_type" text,
	"resolved_model_id" text NOT NULL,
	"resolved_adapter_type" text NOT NULL,
	"resolution" text NOT NULL,
	"fallback_depth" integer DEFAULT 0 NOT NULL,
	"reason" text,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_model_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adapter_type" text NOT NULL,
	"model_id" text NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"status_detail" text,
	"status_changed_at" timestamp with time zone,
	"cooldown_until" timestamp with time zone,
	"cooldown_reason" text,
	"last_probe_status" text,
	"last_probe_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"avg_latency_ms" integer,
	"p95_latency_ms" integer,
	"error_rate_percent" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_model_preferences" ADD CONSTRAINT "company_model_preferences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "model_routing_log" ADD CONSTRAINT "model_routing_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "model_routing_log" ADD CONSTRAINT "model_routing_log_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "company_model_preferences_company_idx" ON "company_model_preferences" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "model_catalog_adapter_model_idx" ON "model_catalog" USING btree ("adapter_type","model_id");
--> statement-breakpoint
CREATE INDEX "model_catalog_provider_idx" ON "model_catalog" USING btree ("provider");
--> statement-breakpoint
CREATE INDEX "model_catalog_tier_idx" ON "model_catalog" USING btree ("tier");
--> statement-breakpoint
CREATE INDEX "model_catalog_is_free_idx" ON "model_catalog" USING btree ("is_free");
--> statement-breakpoint
CREATE INDEX "model_catalog_is_local_idx" ON "model_catalog" USING btree ("is_local");
--> statement-breakpoint
CREATE INDEX "model_routing_log_company_occurred_idx" ON "model_routing_log" USING btree ("company_id","occurred_at");
--> statement-breakpoint
CREATE INDEX "model_routing_log_agent_occurred_idx" ON "model_routing_log" USING btree ("agent_id","occurred_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "provider_model_status_adapter_model_idx" ON "provider_model_status" USING btree ("adapter_type","model_id");
--> statement-breakpoint
CREATE INDEX "provider_model_status_status_idx" ON "provider_model_status" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "provider_model_status_cooldown_until_idx" ON "provider_model_status" USING btree ("cooldown_until");
