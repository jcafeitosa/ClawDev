-- 007: Enable pgvector extension for semantic search.
--
-- pgvector adds vector similarity search to Postgres.
-- Used for issue deduplication and command palette semantic search.

CREATE EXTENSION IF NOT EXISTS vector;
