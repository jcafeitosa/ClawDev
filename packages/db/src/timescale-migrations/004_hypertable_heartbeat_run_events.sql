-- 004: Convert heartbeat_run_events to a TimescaleDB hypertable.
--
-- Partitions by created_at (7-day chunks).
-- Uses bigserial ID — composite PK includes the time column.

ALTER TABLE heartbeat_run_events DROP CONSTRAINT IF EXISTS heartbeat_run_events_pkey;
ALTER TABLE heartbeat_run_events ADD PRIMARY KEY (id, created_at);

SELECT create_hypertable(
  'heartbeat_run_events',
  'created_at',
  chunk_time_interval => INTERVAL '7 days',
  migrate_data => true,
  if_not_exists => true
);
