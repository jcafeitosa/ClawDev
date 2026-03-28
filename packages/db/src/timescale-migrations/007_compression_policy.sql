-- 007: Enable compression on hypertables for data older than 30 days.
--
-- Compressed chunks use ~90% less disk space with minimal query overhead.
-- TimescaleDB transparently decompresses on read.

-- cost_events: compress by company_id, segment by agent_id + provider
ALTER TABLE cost_events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'company_id,agent_id',
  timescaledb.compress_orderby = 'occurred_at DESC'
);

SELECT add_compression_policy('cost_events',
  compress_after => INTERVAL '30 days',
  if_not_exists => true
);

-- activity_log: compress by company_id
ALTER TABLE activity_log SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'company_id',
  timescaledb.compress_orderby = 'created_at DESC'
);

SELECT add_compression_policy('activity_log',
  compress_after => INTERVAL '30 days',
  if_not_exists => true
);

-- heartbeat_run_events: compress by run_id (most queries are per-run)
ALTER TABLE heartbeat_run_events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'run_id',
  timescaledb.compress_orderby = 'created_at DESC,seq'
);

SELECT add_compression_policy('heartbeat_run_events',
  compress_after => INTERVAL '30 days',
  if_not_exists => true
);
