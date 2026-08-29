const pool = require('../config/db');

const COLUMNS = 'id, location_id, start_year, description, gm_note, image_url, name, marker_icon, marker_level, created_at, updated_at';

// Chronological versions of a location's lore. Every write is scoped by
// location_id as well as id (defensive, like map-lens-version / map-pin) so a
// guessed version id can't touch another location's row. name / marker_icon /
// marker_level are nullable overrides — NULL inherits the base maps.locations row.
const LocationVersionModel = {
  async listByLocation(locationId) {
    const { rows } = await pool.query(
      `SELECT ${COLUMNS}
       FROM maps.location_versions
       WHERE location_id = $1
       ORDER BY start_year ASC NULLS LAST`,
      [locationId]
    );
    return rows;
  },

  async countByLocation(locationId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM maps.location_versions WHERE location_id = $1`,
      [locationId]
    );
    return rows[0].count;
  },

  async add(locationId, { startYear, description, gmNote, imageUrl, name, markerIcon, markerLevel }) {
    const { rows } = await pool.query(
      `INSERT INTO maps.location_versions
         (location_id, start_year, description, gm_note, image_url, name, marker_icon, marker_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${COLUMNS}`,
      [locationId, startYear, description ?? null, gmNote ?? null, imageUrl ?? null,
        name ?? null, markerIcon ?? null, markerLevel ?? null]
    );
    return rows[0];
  },

  async update(id, locationId, { startYear, description, gmNote, imageUrl, name, markerIcon, markerLevel }) {
    const { rows } = await pool.query(
      `UPDATE maps.location_versions
       SET start_year = $3, description = $4, gm_note = $5, image_url = $6,
           name = $7, marker_icon = $8, marker_level = $9, updated_at = NOW()
       WHERE id = $1 AND location_id = $2
       RETURNING ${COLUMNS}`,
      [id, locationId, startYear, description ?? null, gmNote ?? null, imageUrl ?? null,
        name ?? null, markerIcon ?? null, markerLevel ?? null]
    );
    return rows[0] || null;
  },

  async remove(id, locationId) {
    const { rowCount } = await pool.query(
      `DELETE FROM maps.location_versions WHERE id = $1 AND location_id = $2`,
      [id, locationId]
    );
    return rowCount > 0;
  },
};

module.exports = LocationVersionModel;
