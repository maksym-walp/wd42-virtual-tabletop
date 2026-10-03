const pool = require('../config/db');

// Cross-schema read into auth.users — admin shares the DB with every other
// service, same convention as e.g. spellbook joining auth.users for owner_username.
const UserModel = {
  async findAll() {
    const { rows } = await pool.query(
      `SELECT id, email, username, role, is_active, created_at
       FROM auth.users
       ORDER BY created_at DESC`
    );
    return rows;
  },

  async updateRole(id, role) {
    const { rows } = await pool.query(
      `UPDATE auth.users SET role = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, username, role, is_active, created_at`,
      [id, role]
    );
    return rows[0] || null;
  },
};

module.exports = UserModel;
