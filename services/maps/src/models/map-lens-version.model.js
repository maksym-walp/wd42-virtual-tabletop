const pool = require('../config/db');

// Dated image versions of a lens. Every write is scoped by map_lens_id as well
// as id (defensive, like map-lens / map-pin) so a guessed version id can't touch
// another lens's row even if the lens-level check ever regresses.
const MapLensVersionModel = {
  async listByLens(lensId) {
    const { rows } = await pool.query(
      `SELECT id, map_lens_id, year, image_url, created_at, updated_at
       FROM maps.map_lens_versions
       WHERE map_lens_id = $1
       ORDER BY year ASC NULLS LAST`,
      [lensId]
    );
    return rows;
  },

  async countByLens(lensId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM maps.map_lens_versions WHERE map_lens_id = $1`,
      [lensId]
    );
    return rows[0].count;
  },

  async add(lensId, { year, imageUrl }) {
    const { rows } = await pool.query(
      `INSERT INTO maps.map_lens_versions (map_lens_id, year, image_url)
       VALUES ($1, $2, $3)
       RETURNING id, map_lens_id, year, image_url, created_at, updated_at`,
      [lensId, year, imageUrl]
    );
    return rows[0];
  },

  async update(id, lensId, { year, imageUrl }) {
    const { rows } = await pool.query(
      `UPDATE maps.map_lens_versions
       SET year = $3, image_url = $4, updated_at = NOW()
       WHERE id = $1 AND map_lens_id = $2
       RETURNING id, map_lens_id, year, image_url, created_at, updated_at`,
      [id, lensId, year, imageUrl]
    );
    return rows[0] || null;
  },

  async remove(id, lensId) {
    const { rowCount } = await pool.query(
      `DELETE FROM maps.map_lens_versions WHERE id = $1 AND map_lens_id = $2`,
      [id, lensId]
    );
    return rowCount > 0;
  },
};

module.exports = MapLensVersionModel;
