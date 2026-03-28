-- 003: Convert activity_log to a TimescaleDB hypertable.
--
-- Partitions by created_at (7-day chunks).

ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_pkey;
ALTER TABLE activity_log ADD PRIMARY KEY (id, created_at);

SELECT create_hypertable(
  'activity_log',
  'created_at',
  chunk_time_interval => INTERVAL '7 days',
  migrate_data => true,
  if_not_exists => true
);
