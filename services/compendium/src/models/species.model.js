const pool = require('../config/db');

const SpeciesModel = {
  async create({ createdBy, name, description, isPublic, healthDie }) {
    const { rows } = await pool.query(
      `INSERT INTO compendium.species (created_by, name, description, is_public, health_die)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [createdBy, name, description ?? null, isPublic ?? false, healthDie ?? 'd6']
    );
    return rows[0];
  },

  async findAll(userId, isAdmin) {
    const { rows } = await pool.query(
      `SELECT *, (created_by = $1) AS is_owner FROM compendium.species
       WHERE ($2::bool OR created_by = $1 OR is_public = true)
       ORDER BY name ASC`,
      [userId, isAdmin]
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT *, (created_by = $2) AS is_owner FROM compendium.species WHERE id = $1`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async update(id, { name, description, isPublic, healthDie }) {
    const { rows } = await pool.query(
      `UPDATE compendium.species
       SET name = $2, description = $3, is_public = $4, health_die = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, name, description ?? null, isPublic ?? false, healthDie ?? 'd6']
    );
    return rows[0] || null;
  },

  async remove(id) {
    const { rowCount } = await pool.query(`DELETE FROM compendium.species WHERE id = $1`, [id]);
    return rowCount > 0;
  },
};

module.exports = SpeciesModel;
