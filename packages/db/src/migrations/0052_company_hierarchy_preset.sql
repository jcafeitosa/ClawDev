-- Company hierarchy presets and initial structure support

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "hierarchy_preset" text NOT NULL DEFAULT 'classic_pyramid';
