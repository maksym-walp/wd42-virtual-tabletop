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

  async update(userId, { displayName, bio, avatarUrl }) {
    const { rows } = await pool.query(
      `UPDATE user_profile.profiles
       SET display_name = COALESCE($2, display_name),
           bio          = COALESCE($3, bio),
           avatar_url   = COALESCE($4, avatar_url),
           updated_at   = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [userId, displayName ?? null, bio ?? null, avatarUrl ?? null]
    );
    return rows[0] || null;
  },

  // Get or create profile on first access
  async upsert(userId) {
    const existing = await ProfileModel.findByUserId(userId);
    return existing || ProfileModel.create(userId);
  },
};

module.exports = ProfileModel;
