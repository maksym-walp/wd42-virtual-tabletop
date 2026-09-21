const pool = require('../config/db');

const PeopleModel = {
  async create({ createdBy, raceId, name, description, origin, isPublic }) {
    const { rows } = await pool.query(
      `INSERT INTO compendium.peoples (race_id, created_by, name, description, origin, is_public)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [raceId, createdBy, name, description ?? null, origin ?? null, isPublic ?? false]
    );
    return rows[0];
  },

  async findAll(userId, isAdmin, raceId) {
    const params = [userId, isAdmin];
    const conditions = ['($2::bool OR created_by = $1 OR is_public = true)'];
    if (raceId) {
      params.push(raceId);
      conditions.push(`race_id = $${params.length}`);
    }
    const { rows } = await pool.query(
      `SELECT *, (created_by = $1) AS is_owner FROM compendium.peoples WHERE ${conditions.join(' AND ')} ORDER BY name ASC`,
      params
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT *, (created_by = $2) AS is_owner FROM compendium.peoples WHERE id = $1`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async update(id, { name, description, origin, isPublic }) {
    const { rows } = await pool.query(
      `UPDATE compendium.peoples
       SET name = $2, description = $3, origin = $4, is_public = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, name, description ?? null, origin ?? null, isPublic ?? false]
    );
    return rows[0] || null;
  },

  async remove(id) {
    const { rowCount } = await pool.query(`DELETE FROM compendium.peoples WHERE id = $1`, [id]);
    return rowCount > 0;
  },
};

module.exports = PeopleModel;
