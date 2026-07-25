const pool = require('../config/db');

const MapLensModel = {
  async listByMap(mapId) {
    const { rows } = await pool.query(
      `SELECT * FROM maps.map_lenses
       WHERE map_id = $1
       ORDER BY created_at ASC`,
      [mapId]
    );
    return rows;
  },

  async add(mapId, name, imageUrl) {
    const { rows } = await pool.query(
      `INSERT INTO maps.map_lenses (map_id, name, image_url)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [mapId, name, imageUrl]
    );
    return rows[0];
  },

  // Scope by both lens id AND map_id: even if the map-level check ever regresses,
  // a guessed id cannot touch another map's lens (mirrors campaign-gallery).
  async update(id, mapId, { name, imageUrl }) {
    const { rows } = await pool.query(
      `UPDATE maps.map_lenses
       SET name = $3, image_url = $4, updated_at = NOW()
       WHERE id = $1 AND map_id = $2
       RETURNING *`,
      [id, mapId, name, imageUrl]
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
