-- 009: Add UNIQUE constraint to embeddings table.
--
-- The embedding-service upserts via ON CONFLICT (company_id, entity_type, entity_id)
-- which requires an actual UNIQUE constraint (or unique index) to work correctly.
-- Without this, concurrent upserts can insert duplicates.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'embeddings'::regclass
      AND conname = 'embeddings_unique_entity'
  ) THEN
    ALTER TABLE embeddings
      ADD CONSTRAINT embeddings_unique_entity
        UNIQUE (company_id, entity_type, entity_id);
  END IF;
END
$$;

-- Drop the plain index that is now made redundant by the unique constraint
-- (the constraint creates its own unique index automatically).
DROP INDEX IF EXISTS embeddings_company_entity_idx;
