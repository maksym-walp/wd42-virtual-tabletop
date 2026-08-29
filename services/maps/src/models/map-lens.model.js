const pool = require('../config/db');

const MapLensModel = {
  // Each lens carries its dated image versions (maps.map_lens_versions) as a
  // nested array, oldest year first with the timeless (year IS NULL) row last.
  async listByMap(mapId) {
    const { rows } = await pool.query(
      `SELECT l.id, l.map_id, l.name, l.created_at, l.updated_at,
              COALESCE((
                SELECT json_agg(v ORDER BY v.year ASC NULLS LAST)
                FROM (
                  SELECT id, year, image_url
                  FROM maps.map_lens_versions
                  WHERE map_lens_id = l.id
                ) v
              ), '[]'::json) AS versions
       FROM maps.map_lenses l
       WHERE l.map_id = $1
       ORDER BY l.created_at ASC`,
      [mapId]
    );
    return rows;
  },

  async findById(id, mapId) {
    const { rows } = await pool.query(
      `SELECT * FROM maps.map_lenses WHERE id = $1 AND map_id = $2`,
      [id, mapId]
    );
    return rows[0] || null;
  },

  // The lens's first image is created separately as its first version (see
  // MapLensController.add) — this stays a plain INSERT of the lens identity.
  async add(mapId, name) {
    const { rows } = await pool.query(
      `INSERT INTO maps.map_lenses (map_id, name)
       VALUES ($1, $2)
       RETURNING *`,
      [mapId, name]
    );
    return rows[0];
  },

  // Rename only — the image(s) live on map_lens_versions now. Scoped by both
  // lens id AND map_id (mirrors campaign-gallery / map-pin).
  async update(id, mapId, { name }) {
    const { rows } = await pool.query(
      `UPDATE maps.map_lenses
       SET name = $3, updated_at = NOW()
       WHERE id = $1 AND map_id = $2
       RETURNING *`,
      [id, mapId, name]
    );
    return rows[0] || null;
  },

  async remove(id, mapId) {
    const { rowCount } = await pool.query(
      `DELETE FROM maps.map_lenses WHERE id = $1 AND map_id = $2`,
      [id, mapId]
    );
    return rowCount > 0;
  },
};

module.exports = MapLensModel;
