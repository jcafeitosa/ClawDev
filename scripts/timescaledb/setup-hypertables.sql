-- TimescaleDB Setup: Hypertables + Continuous Aggregates + Compression
--
-- This script is optional and requires TimescaleDB extension.
-- Run against a Postgres instance with TimescaleDB installed:
--   psql -d clawdev -f scripts/timescaledb/setup-hypertables.sql
--
-- Safe to run multiple times (all operations are idempotent).

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ============================================================================
-- Hypertables
-- ============================================================================

-- Convert cost_events to hypertable (partitioned by created_at)
SELECT create_hypertable(
  'cost_events',
  by_range('created_at'),
  migrate_data => true,
  if_not_exists => true
);

-- Convert activity_log to hypertable
SELECT create_hypertable(
  'activity_log',
  by_range('created_at'),
  migrate_data => true,
  if_not_exists => true
);

-- Convert heartbeat_run_events to hypertable
SELECT create_hypertable(
  'heartbeat_run_events',
  by_range('created_at'),
  migrate_data => true,
  if_not_exists => true
);

-- ============================================================================
-- Continuous Aggregates
-- ============================================================================

-- Daily costs per agent
CREATE MATERIALIZED VIEW IF NOT EXISTS costs_daily
WITH (timescaledb.continuous) AS
SELECT
  company_id,
  agent_id,
  provider,
  biller,
  time_bucket('1 day', created_at) AS day,
  SUM(cost_cents) AS total_cost_cents,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  COUNT(*) AS event_count
FROM cost_events
GROUP BY company_id, agent_id, provider, biller, day
WITH NO DATA;

-- Monthly costs per agent
CREATE MATERIALIZED VIEW IF NOT EXISTS costs_monthly
WITH (timescaledb.continuous) AS
SELECT
  company_id,
  agent_id,
  provider,
  biller,
  time_bucket('1 month', created_at) AS month,
  SUM(cost_cents) AS total_cost_cents,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  COUNT(*) AS event_count
FROM cost_events
GROUP BY company_id, agent_id, provider, biller, month
WITH NO DATA;

-- Daily activity counts
CREATE MATERIALIZED VIEW IF NOT EXISTS activity_daily
WITH (timescaledb.continuous) AS
SELECT
  company_id,
  action,
  entity_type,
  actor_type,
  time_bucket('1 day', created_at) AS day,
  COUNT(*) AS event_count
FROM activity_log
GROUP BY company_id, action, entity_type, actor_type, day
WITH NO DATA;

-- ============================================================================
-- Refresh Policies (auto-refresh continuous aggregates)
-- ============================================================================

SELECT add_continuous_aggregate_policy('costs_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => true
);

SELECT add_continuous_aggregate_policy('costs_monthly',
  start_offset => INTERVAL '3 months',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day',
  if_not_exists => true
);

SELECT add_continuous_aggregate_policy('activity_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => true
);

-- ============================================================================
-- Compression Policies
-- ============================================================================

-- cost_events: compress after 30 days
ALTER TABLE cost_events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'company_id, agent_id',
  timescaledb.compress_orderby = 'created_at DESC'
);
SELECT add_compression_policy('cost_events', INTERVAL '30 days', if_not_exists => true);

-- activity_log: compress after 30 days
ALTER TABLE activity_log SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'company_id',
  timescaledb.compress_orderby = 'created_at DESC'
);
SELECT add_compression_policy('activity_log', INTERVAL '30 days', if_not_exists => true);

-- heartbeat_run_events: compress after 14 days
ALTER TABLE heartbeat_run_events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'company_id, run_id',
  timescaledb.compress_orderby = 'created_at DESC'
);
SELECT add_compression_policy('heartbeat_run_events', INTERVAL '14 days', if_not_exists => true);
