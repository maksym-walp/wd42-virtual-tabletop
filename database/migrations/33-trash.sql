-- Trash: a generic archive for hard-deleted records across every service.
-- Deleting a character/spell/item/entry/collection/tradition now snapshots
-- the row (plus anything that would otherwise be lost to an ON DELETE
-- CASCADE, e.g. a collection's items or a character's skills) into
-- trash.deleted_records instead of just discarding it, so an admin without
-- shell/DB-console access to the app can still recover it via adminer by
-- hand — no restore UI, just visibility + a JSONB blob to copy back.
--
-- One shared table for all services (not per-schema) since every service
-- already talks to this same Postgres instance and cross-schema querying is
-- an established convention here (see e.g. collections' LEFT JOIN
-- auth.users). schema_name/table_name identify where the row came from;
-- record is the full row as it looked right before deletion; children holds
-- any cascade-deleted child rows keyed by their table name, so a restore
-- can reconstruct associations (collection_items, tradition_spells,
-- a character's skills/known_spells/tree_progress/etc.) instead of just the
-- bare parent row.

CREATE SCHEMA IF NOT EXISTS trash;

CREATE TABLE IF NOT EXISTS trash.deleted_records (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_name  TEXT        NOT NULL,
    table_name   TEXT        NOT NULL,
    record_id    UUID        NOT NULL,
    record       JSONB       NOT NULL,
    children     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    deleted_by   UUID,
    deleted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trash_deleted_records_table
    ON trash.deleted_records (schema_name, table_name);
CREATE INDEX IF NOT EXISTS idx_trash_deleted_records_record_id
    ON trash.deleted_records (record_id);
