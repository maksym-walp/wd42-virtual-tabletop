const AuthService = require('../services/auth.service');

const REFRESH_COOKIE = 'refresh_token';

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

const AuthController = {
  async register(req, res) {
    const { email, username, password } = req.body;
    const { user, accessToken, refreshToken } = await AuthService.register({ email, username, password });
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts);
    res.status(201).json({
      accessToken,
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    });
  },

  async login(req, res) {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await AuthService.login({ email, password });
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts);
    res.json({ accessToken, user });
  },

  async refresh(req, res) {
    const refreshToken = req.cookies[REFRESH_COOKIE];
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });
    const { accessToken } = await AuthService.refresh(refreshToken);
    res.json({ accessToken });
  },

  async logout(req, res) {
    const refreshToken = req.cookies[REFRESH_COOKIE];
    await AuthService.logout(req.user.sub, refreshToken);
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    res.json({ message: 'Logged out' });
  },

  async me(req, res) {
    // Normalize to the same shape login/register return — req.user is the
    // raw JWT payload (sub/iat/exp), not {id, email, username, role}.
    const { sub, email, username, role } = req.user;
    res.json({ user: { id: sub, email, username, role } });
  },

  async updateAccount(req, res) {
    const { email, username } = req.body;
    const { user, accessToken } = await AuthService.updateAccount(req.user.sub, { email, username });
    res.json({ user, accessToken });
  },

  async changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;
    await AuthService.changePassword(req.user.sub, { currentPassword, newPassword });
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    res.json({ message: 'Password changed' });
  },

  // Used by other services or external clients to validate a token
  async validate(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false });
    }
    try {
      const payload = AuthService.verifyAccessToken(authHeader.slice(7));
      res.json({ valid: true, user: payload });
    } catch {
      res.status(401).json({ valid: false });
    }
  },
};

module.exports = AuthController;
