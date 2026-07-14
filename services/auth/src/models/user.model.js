const pool = require('../config/db');

const UserModel = {
  async findByEmail(email) {
    const { rows } = await pool.query(
      'SELECT * FROM auth.users WHERE email = $1 AND is_active = true',
      [email]
    );
    return rows[0] || null;
  },

  async findByUsername(username) {
    const { rows } = await pool.query(
      'SELECT * FROM auth.users WHERE username = $1 AND is_active = true',
      [username]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await pool.query(
      'SELECT id, email, username, role, is_active, created_at FROM auth.users WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  },

  async findByIdWithPassword(id) {
    const { rows } = await pool.query('SELECT * FROM auth.users WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async updateAccount(id, { email, username }) {
    const { rows } = await pool.query(
      `UPDATE auth.users
       SET email      = COALESCE($2, email),
           username   = COALESCE($3, username),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, username, role, is_active, created_at`,
      [id, email ?? null, username ?? null]
    );
    return rows[0] || null;
  },

  async updatePassword(id, passwordHash) {
    await pool.query(
      'UPDATE auth.users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
      [id, passwordHash]
    );
  },

  async create({ email, username, passwordHash }) {
    const { rows } = await pool.query(
      `INSERT INTO auth.users (email, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, username, role, created_at`,
      [email, username, passwordHash]
    );
    return rows[0];
  },

  async saveRefreshToken(userId, tokenHash, expiresAt) {
    await pool.query(
      'INSERT INTO auth.refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt]
    );
  },

  async findRefreshToken(userId, tokenHash) {
    const { rows } = await pool.query(
      'SELECT * FROM auth.refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()',
      [userId, tokenHash]
    );
    return rows[0] || null;
  },

  async deleteRefreshToken(userId, tokenHash) {
    await pool.query(
      'DELETE FROM auth.refresh_tokens WHERE user_id = $1 AND token_hash = $2',
      [userId, tokenHash]
    );
  },

  async deleteAllRefreshTokens(userId) {
    await pool.query('DELETE FROM auth.refresh_tokens WHERE user_id = $1', [userId]);
  },

  async cleanExpiredTokens() {
    await pool.query('DELETE FROM auth.refresh_tokens WHERE expires_at <= NOW()');
  },
};

module.exports = UserModel;
