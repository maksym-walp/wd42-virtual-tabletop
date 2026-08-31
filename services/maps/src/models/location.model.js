const pool = require('../config/db');

// Locations are owned by created_by. Their time-varying lore (description,
// gm_note, image, name/marker/types overrides) lives on maps.location_versions
// — the base row here holds the identity + default marker + default types.
// gm_note stripping from non-owner responses is the controller's job
// (access.serializeLocation).
const VERSIONS_AGG = `
  COALESCE((
    SELECT json_agg(v ORDER BY v.start_year ASC NULLS LAST)
    FROM (
      SELECT id, start_year, end_year, description, gm_note, image_url, name, marker_icon, marker_level, types
      FROM maps.location_versions
      WHERE location_id = l.id
    ) v
  ), '[]'::json) AS versions`;

const LocationModel = {
  async create({ createdBy, name, types, markerIcon, markerLevel }) {
    const { rows } = await pool.query(
      `INSERT INTO maps.locations (created_by, name, types, marker_icon, marker_level)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [createdBy, name, types ?? [], markerIcon ?? null, markerLevel ?? null]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT * FROM maps.locations WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByIdWithVersions(id) {
    const { rows } = await pool.query(
      `SELECT l.*, ${VERSIONS_AGG} FROM maps.locations l WHERE l.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async listByOwner(userId) {
    const { rows } = await pool.query(
      `SELECT l.*, ${VERSIONS_AGG}
       FROM maps.locations l
       WHERE l.created_by = $1
       ORDER BY l.created_at DESC`,
      [userId]
    );
    return rows;
  },

  // True if the location is pinned on at least one map the user may read
  // (their own, public, or any when admin) — used to gate location reads for
  // players viewing someone else's public map.
  async isPinnedOnReadableMap(locationId, userId, admin) {
    const { rows } = await pool.query(
      `SELECT 1
       FROM maps.map_pins p
       JOIN maps.maps m ON m.id = p.map_id
       WHERE p.location_id = $1
         AND ($3::bool OR m.created_by = $2 OR m.is_public = true)
       LIMIT 1`,
      [locationId, userId, admin]
    );
    return rows.length > 0;
  },

  async update(id, { name, types, markerIcon, markerLevel }) {
    const { rows } = await pool.query(
      `UPDATE maps.locations
       SET name = $2, types = $3, marker_icon = $4, marker_level = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, name, types ?? [], markerIcon ?? null, markerLevel ?? null]
    );
    return rows[0] || null;
  },

  async remove(id) {
    const { rowCount } = await pool.query(
      `DELETE FROM maps.locations WHERE id = $1`,
      [id]
    );
    return rowCount > 0;
  },

  // Bulk import of previously exported locations. Each record becomes a new
  // location (own id, created_by forced to the importer) plus its versions.
  // image_url is dropped on every version — images from a foreign export don't
  // live on this disk (same rule as the equipment importer). A record with no
  // versions still gets one empty base version so the location isn't broken.
  // All-or-nothing: the whole batch runs in one transaction.
  async bulkImport(userId, records, { toBase, toVersion }) {
    const client = await pool.connect();
    let imported = 0;
    try {
      await client.query('BEGIN');
      for (const record of records) {
        if (!record || typeof record !== 'object') continue;
        const base = toBase(record);
        if (!base.name) continue;
        const { rows } = await client.query(
          `INSERT INTO maps.locations (created_by, name, types, marker_icon, marker_level)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [userId, base.name, base.types, base.markerIcon, base.markerLevel]
        );
        const locationId = rows[0].id;

        const versions = Array.isArray(record.versions) && record.versions.length
          ? record.versions
          : [{}];
        for (const rawVersion of versions) {
          const v = toVersion(rawVersion);
          await client.query(
            `INSERT INTO maps.location_versions
               (location_id, start_year, end_year, description, gm_note, image_url, name, marker_icon, marker_level, types)
             VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9)`,
            [locationId, v.startYear, v.endYear, v.description, v.gmNote, v.name, v.markerIcon, v.markerLevel, v.types]
          );
        }
        imported += 1;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return imported;
  },
};

module.exports = LocationModel;
