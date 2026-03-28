-- 009: Create embeddings table with vector index for semantic search.

CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS embeddings_company_entity_idx ON embeddings(company_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS embeddings_company_type_idx ON embeddings(company_id, entity_type);

-- HNSW vector index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS embeddings_vector_idx ON embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
