-- 001: Enable TimescaleDB extension
-- Must run BEFORE creating hypertables.

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
