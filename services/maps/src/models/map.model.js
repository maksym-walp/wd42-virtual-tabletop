const pool = require('../config/db');

// Standalone maps owned by created_by. Auth (owner/public/admin) is resolved in
// the controller — no user gate here.
const MapModel = {
  async create(createdBy, name, isPublic) {
    const { rows } = await pool.query(
      `INSERT INTO maps.maps (created_by, name, is_public)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [createdBy, name, isPublic]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT * FROM maps.maps WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  // Maps visible to the user: their own + public ones (admin sees all).
  // is_owner lets the client decide which edit affordances to show.
  async listVisible(userId, admin) {
    const { rows } = await pool.query(
      `SELECT *, (created_by = $1) AS is_owner
       FROM maps.maps
       WHERE $2::bool OR created_by = $1 OR is_public = true
       ORDER BY created_at DESC`,
      [userId, admin]
    );
    return rows;
  },

  async update(id, name, isPublic) {
    const { rows } = await pool.query(
      `UPDATE maps.maps SET name = $2, is_public = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, name, isPublic]
    );
    return rows[0] || null;
  },

  async remove(id) {
    const { rowCount } = await pool.query(
      `DELETE FROM maps.maps WHERE id = $1`,
      [id]
    );
    return rowCount > 0;
  },
};

module.exports = MapModel;
