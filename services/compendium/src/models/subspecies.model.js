const pool = require('../config/db');

const SubspeciesModel = {
  async create({ createdBy, speciesId, name, description, isPublic, healthDie }) {
    const { rows } = await pool.query(
      `INSERT INTO compendium.subspecies (species_id, created_by, name, description, is_public, health_die)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [speciesId, createdBy, name, description ?? null, isPublic ?? false, healthDie ?? 'd6']
    );
    return rows[0];
  },

  async findAll(userId, isAdmin, speciesId) {
    const params = [userId, isAdmin];
    const conditions = ['($2::bool OR created_by = $1 OR is_public = true)'];
    if (speciesId) {
      params.push(speciesId);
      conditions.push(`species_id = $${params.length}`);
    }
    const { rows } = await pool.query(
      `SELECT *, (created_by = $1) AS is_owner FROM compendium.subspecies WHERE ${conditions.join(' AND ')} ORDER BY name ASC`,
      params
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT *, (created_by = $2) AS is_owner FROM compendium.subspecies WHERE id = $1`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async update(id, { name, description, isPublic, healthDie }) {
    const { rows } = await pool.query(
      `UPDATE compendium.subspecies
       SET name = $2, description = $3, is_public = $4, health_die = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, name, description ?? null, isPublic ?? false, healthDie ?? 'd6']
    );
    return rows[0] || null;
  },

  async remove(id) {
    const { rowCount } = await pool.query(`DELETE FROM compendium.subspecies WHERE id = $1`, [id]);
    return rowCount > 0;
  },
};

module.exports = SubspeciesModel;
