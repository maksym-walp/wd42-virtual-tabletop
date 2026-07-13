-- ================================================================
-- Migration: default new characters to public
--   Characters are now public by default; players opt into privacy
--   instead of opting into sharing.
-- ================================================================

ALTER TABLE character_sheet.characters ALTER COLUMN is_public SET DEFAULT true;
