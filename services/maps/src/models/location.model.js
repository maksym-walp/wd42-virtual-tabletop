const pool = require('../config/db');

// Locations are owned by created_by. gm_note lives on the row; stripping it from
// non-owner responses is the controller's job (access.stripGmNote).
const LocationModel = {
  async create({ createdBy, name, description, gmNote, imageUrl, type }) {
    const { rows } = await pool.query(
      `INSERT INTO maps.locations
         (created_by, name, description, gm_note, image_url, type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [createdBy, name, description ?? null, gmNote ?? null, imageUrl ?? null, type ?? null]
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

  async listByOwner(userId) {
    const { rows } = await pool.query(
      `SELECT * FROM maps.locations
       WHERE created_by = $1
       ORDER BY created_at DESC`,
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

  async update(id, { name, description, gmNote, imageUrl, type }) {
    const { rows } = await pool.query(
      `UPDATE maps.locations
       SET name = $2, description = $3, gm_note = $4, image_url = $5, type = $6,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, name, description ?? null, gmNote ?? null, imageUrl ?? null, type ?? null]
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
};

module.exports = LocationModel;
