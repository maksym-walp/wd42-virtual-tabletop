-- ================================================================
-- Migration: money (currency holdings) on characters
-- ================================================================

ALTER TABLE character_sheet.characters
  ADD COLUMN IF NOT EXISTS money JSONB NOT NULL DEFAULT '{}'::jsonb;
