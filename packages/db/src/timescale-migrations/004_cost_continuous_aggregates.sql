-- 004: Continuous aggregates for cost tracking.
--
-- These materialized views pre-compute hourly and daily cost summaries,
-- dramatically speeding up dashboard and reporting queries.
--
-- TimescaleDB continuous aggregates refresh automatically as new data arrives.

-- Ensure cost_events is a hypertable (should already be from 001)
-- SELECT create_hypertable('cost_events', 'occurred_at', if_not_exists => TRUE);

-- ============================================================
-- Hourly cost aggregates by company + agent
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS cost_hourly_by_agent
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', occurred_at) AS bucket,
  company_id,
  agent_id,
  provider,
  biller,
  billing_type,
  model,
  SUM(cost_cents)::bigint AS total_cost_cents,
  SUM(input_tokens)::bigint AS total_input_tokens,
  SUM(cached_input_tokens)::bigint AS total_cached_input_tokens,
  SUM(output_tokens)::bigint AS total_output_tokens,
  COUNT(DISTINCT heartbeat_run_id) AS run_count,
  COUNT(*) AS event_count
FROM cost_events
GROUP BY bucket, company_id, agent_id, provider, biller, billing_type, model
WITH NO DATA;

-- Refresh policy: materialize hourly data with 2h lag
SELECT add_continuous_aggregate_policy('cost_hourly_by_agent',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '2 hours',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- ============================================================
-- Daily cost aggregates by company (for dashboard)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS cost_daily_by_company
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', occurred_at) AS bucket,
  company_id,
  SUM(cost_cents)::bigint AS total_cost_cents,
  SUM(input_tokens)::bigint AS total_input_tokens,
  SUM(output_tokens)::bigint AS total_output_tokens,
  COUNT(DISTINCT agent_id) AS active_agents,
  COUNT(DISTINCT heartbeat_run_id) AS run_count,
  COUNT(*) AS event_count
FROM cost_events
GROUP BY bucket, company_id
WITH NO DATA;

-- Refresh daily with 1h lag
SELECT add_continuous_aggregate_policy('cost_daily_by_company',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- ============================================================
-- Daily cost aggregates by provider (for cost breakdown reports)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS cost_daily_by_provider
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', occurred_at) AS bucket,
  company_id,
  provider,
  biller,
  billing_type,
  model,
  SUM(cost_cents)::bigint AS total_cost_cents,
  SUM(input_tokens)::bigint AS total_input_tokens,
  SUM(cached_input_tokens)::bigint AS total_cached_input_tokens,
  SUM(output_tokens)::bigint AS total_output_tokens,
  COUNT(DISTINCT agent_id) AS active_agents,
  COUNT(*) AS event_count
FROM cost_events
GROUP BY bucket, company_id, provider, biller, billing_type, model
WITH NO DATA;

SELECT add_continuous_aggregate_policy('cost_daily_by_provider',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);
