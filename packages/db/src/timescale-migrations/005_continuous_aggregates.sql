-- 005: Create continuous aggregates for cost and activity data.
--
-- These materialized views automatically refresh and provide
-- pre-aggregated data for dashboard queries.

-- -----------------------------------------------------------------------
-- costs_daily: daily cost totals per company, agent, and provider
-- -----------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS costs_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', occurred_at) AS bucket,
  company_id,
  agent_id,
  provider,
  biller,
  COUNT(*)::int AS event_count,
  SUM(cost_cents)::bigint AS total_cost_cents,
  SUM(input_tokens)::bigint AS total_input_tokens,
  SUM(cached_input_tokens)::bigint AS total_cached_input_tokens,
  SUM(output_tokens)::bigint AS total_output_tokens
FROM cost_events
GROUP BY bucket, company_id, agent_id, provider, biller
WITH NO DATA;

-- Refresh policy: refresh the last 3 days every hour
SELECT add_continuous_aggregate_policy('costs_daily',
  start_offset => INTERVAL '3 days',
  end_offset   => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => true
);

-- -----------------------------------------------------------------------
-- costs_monthly: monthly cost totals per company and provider
-- -----------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS costs_monthly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 month', occurred_at) AS bucket,
  company_id,
  provider,
  biller,
  COUNT(*)::int AS event_count,
  SUM(cost_cents)::bigint AS total_cost_cents,
  SUM(input_tokens)::bigint AS total_input_tokens,
  SUM(output_tokens)::bigint AS total_output_tokens
FROM cost_events
GROUP BY bucket, company_id, provider, biller
WITH NO DATA;

SELECT add_continuous_aggregate_policy('costs_monthly',
  start_offset => INTERVAL '3 months',
  end_offset   => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day',
  if_not_exists => true
);

-- -----------------------------------------------------------------------
-- activity_daily: daily activity counts per company and action
-- -----------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS activity_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', created_at) AS bucket,
  company_id,
  action,
  entity_type,
  COUNT(*)::int AS event_count
FROM activity_log
GROUP BY bucket, company_id, action, entity_type
WITH NO DATA;

SELECT add_continuous_aggregate_policy('activity_daily',
  start_offset => INTERVAL '3 days',
  end_offset   => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => true
);
