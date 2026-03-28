-- 002: Convert cost_events to a TimescaleDB hypertable.
--
-- Partitions by occurred_at (7-day chunks).
-- The UUID primary key is replaced with a composite (id, occurred_at)
-- since hypertables require the time column in the primary key.

-- Drop the old PK and add a composite one that includes the time column.
ALTER TABLE cost_events DROP CONSTRAINT IF EXISTS cost_events_pkey;
ALTER TABLE cost_events ADD PRIMARY KEY (id, occurred_at);

-- Convert to hypertable with 7-day chunks.
SELECT create_hypertable(
  'cost_events',
  'occurred_at',
  chunk_time_interval => INTERVAL '7 days',
  migrate_data => true,
  if_not_exists => true
);
