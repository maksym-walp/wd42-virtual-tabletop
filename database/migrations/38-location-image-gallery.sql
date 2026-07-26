-- ================================================================
-- Locations get a gallery: a single image_url becomes an array of
-- image_urls. Existing single images are migrated into the array.
-- Replay-safe: the backfill + drop only run while image_url exists.
-- ================================================================

ALTER TABLE maps.locations ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'maps' AND table_name = 'locations' AND column_name = 'image_url'
  ) THEN
    UPDATE maps.locations
      SET image_urls = ARRAY[image_url]
      WHERE image_url IS NOT NULL AND image_url <> ''
        AND array_length(image_urls, 1) IS NULL;
    ALTER TABLE maps.locations DROP COLUMN image_url;
  END IF;
END $$;
