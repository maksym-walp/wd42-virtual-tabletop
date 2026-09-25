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
};

module.exports = UserModel;
