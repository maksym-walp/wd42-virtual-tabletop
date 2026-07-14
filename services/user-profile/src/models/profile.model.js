const pool = require('../config/db');

const ProfileModel = {
  async findByUserId(userId) {
    const { rows } = await pool.query(
      'SELECT * FROM user_profile.profiles WHERE user_id = $1',
      [userId]
    );
    return rows[0] || null;
  },

  async create(userId) {
    const { rows } = await pool.query(
      'INSERT INTO user_profile.profiles (user_id) VALUES ($1) RETURNING *',
      [userId]
    );
    return rows[0];
  },

  // Get or create profile on first access
  async upsert(userId) {
    const existing = await ProfileModel.findByUserId(userId);
    return existing || ProfileModel.create(userId);
  },
};

module.exports = ProfileModel;
