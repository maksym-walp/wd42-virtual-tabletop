const pool = require('../config/db');

const SORT_MAP = {
  name:             'm.name ASC',
  duration_actions: 'm.duration_actions ASC, m.name ASC',
};

const ManeuverModel = {
  async findAll(userId, { search, sort } = {}) {
    const params = [userId];
    const conditions = ['(m.user_id = $1 OR m.is_public = true)'];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`m.name ILIKE $${params.length}`);
    }

    const orderBy = SORT_MAP[sort] || SORT_MAP.name;

    const { rows } = await pool.query(
      `SELECT m.*, (m.user_id = $1) AS is_owner
       FROM maneuvers.entries m
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}`,
      params
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT m.*, (m.user_id = $2) AS is_owner
       FROM maneuvers.entries m
       WHERE m.id = $1 AND (m.user_id = $2 OR m.is_public = true)`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const { name, duration_actions, description, is_public } = data;

    const { rows } = await pool.query(
      `INSERT INTO maneuvers.entries
         (user_id, name, duration_actions, description, is_public)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [userId, name, duration_actions ?? 1, description ?? null, is_public ?? false]
    );
    return rows[0];
  },

  async update(id, userId, data) {
    const { name, duration_actions, description, is_public } = data;

    const { rows } = await pool.query(
      `UPDATE maneuvers.entries
       SET name=$3, duration_actions=$4, description=$5, is_public=$6, updated_at=NOW()
       WHERE id=$1 AND user_id=$2
       RETURNING *`,
      [id, userId, name, duration_actions ?? 1, description ?? null, is_public ?? false]
    );
    return rows[0] || null;
  },

  async delete(id, userId) {
    const { rowCount } = await pool.query(
      'DELETE FROM maneuvers.entries WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rowCount > 0;
  },
};

module.exports = ManeuverModel;
