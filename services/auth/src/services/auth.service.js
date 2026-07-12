const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const UserModel = require('../models/user.model');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, username: user.username, role: user.role },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function generateRefreshToken(user) {
  return jwt.sign({ sub: user.id }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshTokenExpiryDate() {
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const match = REFRESH_EXPIRES.match(/^(\d+)([smhd])$/);
  const ms = match ? parseInt(match[1]) * (map[match[2]] || 86400000) : 7 * 86400000;
  return new Date(Date.now() + ms);
}

const AuthService = {
  async register({ email, username, password }) {
    if (await UserModel.findByEmail(email)) {
      const err = new Error('Email already in use');
      err.statusCode = 409;
      throw err;
    }
    if (await UserModel.findByUsername(username)) {
      const err = new Error('Username already taken');
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await UserModel.create({ email, username, passwordHash });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await UserModel.saveRefreshToken(user.id, hashToken(refreshToken), refreshTokenExpiryDate());

    return { user, accessToken, refreshToken };
  },

  async login({ email, password }) {
    const user = await UserModel.findByEmail(email);
    const valid = user && (await bcrypt.compare(password, user.password_hash));
    if (!valid) {
      // Constant-time failure to prevent user enumeration
      const err = new Error('Invalid credentials');
      err.statusCode = 401;
      throw err;
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await UserModel.saveRefreshToken(user.id, hashToken(refreshToken), refreshTokenExpiryDate());

    return {
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      accessToken,
      refreshToken,
    };
  },

  async refresh(refreshToken) {
    let payload;
    try {
      payload = jwt.verify(refreshToken, REFRESH_SECRET);
    } catch {
      const err = new Error('Invalid refresh token');
      err.statusCode = 401;
      throw err;
    }

    const stored = await UserModel.findRefreshToken(payload.sub, hashToken(refreshToken));
    if (!stored) {
      const err = new Error('Refresh token revoked or expired');
      err.statusCode = 401;
      throw err;
    }

    const user = await UserModel.findById(payload.sub);
    if (!user || !user.is_active) {
      const err = new Error('User not found or inactive');
      err.statusCode = 401;
      throw err;
    }

    return { accessToken: generateAccessToken(user) };
  },

  async logout(userId, refreshToken) {
    if (userId && refreshToken) {
      await UserModel.deleteRefreshToken(userId, hashToken(refreshToken));
    }
  },

  verifyAccessToken(token) {
    return jwt.verify(token, ACCESS_SECRET);
  },

  hashToken,
  refreshTokenExpiryDate,
};

module.exports = AuthService;
