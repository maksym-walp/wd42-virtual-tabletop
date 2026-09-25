const pool = require('../config/db');

const RaceModel = {
  async create({ createdBy, name, description, isPublic }) {
    const { rows } = await pool.query(
      `INSERT INTO compendium.races (created_by, name, description, is_public)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [createdBy, name, description ?? null, isPublic ?? false]
    );
    return rows[0];
  },

  async findAll(userId, isAdmin) {
    const { rows } = await pool.query(
      `SELECT *, (created_by = $1) AS is_owner FROM compendium.races
       WHERE ($2::bool OR created_by = $1 OR is_public = true)
       ORDER BY name ASC`,
      [userId, isAdmin]
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT *, (created_by = $2) AS is_owner FROM compendium.races WHERE id = $1`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async update(id, { name, description, isPublic }) {
    const { rows } = await pool.query(
      `UPDATE compendium.races
       SET name = $2, description = $3, is_public = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, name, description ?? null, isPublic ?? false]
    );
    return rows[0] || null;
  },

  async remove(id) {
    const { rowCount } = await pool.query(`DELETE FROM compendium.races WHERE id = $1`, [id]);
    return rowCount > 0;
  },

  async setOwner(id, ownerUsername) {
    const { rows } = await pool.query(
      `UPDATE compendium.races
       SET created_by = (SELECT id FROM auth.users WHERE username = $2), updated_at = NOW()
       WHERE id = $1 AND EXISTS (SELECT 1 FROM auth.users WHERE username = $2)
       RETURNING *`,
      [id, ownerUsername]
    );
    return rows[0] || null;
  },
};

module.exports = RaceModel;
