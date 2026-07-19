jest.mock('../../services/auth.service');

const AuthService = require('../../services/auth.service');
const AuthController = require('../auth.controller');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };
}

function mockReq(overrides = {}) {
  return { body: {}, cookies: {}, headers: {}, ...overrides };
}

const cookieOpts = {
  httpOnly: true,
  secure: false,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

beforeEach(() => jest.clearAllMocks());

describe('AuthController.register', () => {
  it('sets the refresh cookie and returns a trimmed user with 201', async () => {
    AuthService.register.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', username: 'alice', role: 'user', password_hash: 'secret', created_at: 'x' },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    const req = mockReq({ body: { email: 'a@b.com', username: 'alice', password: 'password1' } });
    const res = mockRes();

    await AuthController.register(req, res);

    expect(AuthService.register).toHaveBeenCalledWith({ email: 'a@b.com', username: 'alice', password: 'password1' });
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'refresh-token', cookieOpts);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      accessToken: 'access-token',
      user: { id: 'u1', email: 'a@b.com', username: 'alice', role: 'user' },
    });
  });
});

describe('AuthController.login', () => {
  it('sets the refresh cookie and returns the user as-is', async () => {
    const user = { id: 'u1', email: 'a@b.com', username: 'alice', role: 'user' };
    AuthService.login.mockResolvedValue({ user, accessToken: 'access-token', refreshToken: 'refresh-token' });
    const req = mockReq({ body: { email: 'a@b.com', password: 'password1' } });
    const res = mockRes();

    await AuthController.login(req, res);

    expect(AuthService.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password1' });
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'refresh-token', cookieOpts);
    expect(res.json).toHaveBeenCalledWith({ accessToken: 'access-token', user });
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('AuthController.refresh', () => {
  it('returns 401 with no message when there is no refresh cookie', async () => {
    const req = mockReq({ cookies: {} });
    const res = mockRes();

    await AuthController.refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No refresh token' });
    expect(AuthService.refresh).not.toHaveBeenCalled();
  });

  it('returns a new access token on success', async () => {
    AuthService.refresh.mockResolvedValue({ accessToken: 'new-access-token' });
    const req = mockReq({ cookies: { refresh_token: 'refresh-token' } });
    const res = mockRes();

    await AuthController.refresh(req, res);

    expect(AuthService.refresh).toHaveBeenCalledWith('refresh-token');
    expect(res.json).toHaveBeenCalledWith({ accessToken: 'new-access-token' });
  });
});

describe('AuthController.logout', () => {
  it('logs out, clears the cookie, and returns a message', async () => {
    AuthService.logout.mockResolvedValue(undefined);
    const req = mockReq({ cookies: { refresh_token: 'refresh-token' }, user: { sub: 'u1' } });
    const res = mockRes();

    await AuthController.logout(req, res);

    expect(AuthService.logout).toHaveBeenCalledWith('u1', 'refresh-token');
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' });
    expect(res.json).toHaveBeenCalledWith({ message: 'Logged out' });
  });
});

describe('AuthController.me', () => {
  it('reshapes the raw JWT payload, mapping sub to id and dropping iat/exp', async () => {
    const req = mockReq({
      user: { sub: 'u1', email: 'a@b.com', username: 'alice', role: 'user', iat: 111, exp: 222 },
    });
    const res = mockRes();

    await AuthController.me(req, res);

    expect(res.json).toHaveBeenCalledWith({
      user: { id: 'u1', email: 'a@b.com', username: 'alice', role: 'user' },
    });
    const returned = res.json.mock.calls[0][0].user;
    expect(returned).not.toHaveProperty('sub');
    expect(returned).not.toHaveProperty('iat');
    expect(returned).not.toHaveProperty('exp');
  });
});

describe('AuthController.updateAccount', () => {
  it('delegates to AuthService and returns the user and access token', async () => {
    const user = { id: 'u1', email: 'new@b.com', username: 'alice2', role: 'user' };
    AuthService.updateAccount.mockResolvedValue({ user, accessToken: 'access-token' });
    const req = mockReq({ body: { email: 'new@b.com', username: 'alice2' }, user: { sub: 'u1' } });
    const res = mockRes();

    await AuthController.updateAccount(req, res);

    expect(AuthService.updateAccount).toHaveBeenCalledWith('u1', { email: 'new@b.com', username: 'alice2' });
    expect(res.json).toHaveBeenCalledWith({ user, accessToken: 'access-token' });
  });
});

describe('AuthController.changePassword', () => {
  it('delegates to AuthService, clears the cookie, and returns a message', async () => {
    AuthService.changePassword.mockResolvedValue(undefined);
    const req = mockReq({
      body: { currentPassword: 'old-password', newPassword: 'new-password' },
      user: { sub: 'u1' },
    });
    const res = mockRes();

    await AuthController.changePassword(req, res);

    expect(AuthService.changePassword).toHaveBeenCalledWith('u1', {
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' });
    expect(res.json).toHaveBeenCalledWith({ message: 'Password changed' });
  });
});

describe('AuthController.validate', () => {
  it('returns 401 {valid:false} when the Authorization header is missing', async () => {
    const req = mockReq({ headers: {} });
    const res = mockRes();

    await AuthController.validate(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ valid: false });
    expect(AuthService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('returns 401 {valid:false} when the Authorization header is malformed', async () => {
    const req = mockReq({ headers: { authorization: 'Basic abc123' } });
    const res = mockRes();

    await AuthController.validate(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ valid: false });
    expect(AuthService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('returns {valid:true, user: payload} for a valid Bearer token', async () => {
    const payload = { sub: 'u1', email: 'a@b.com', username: 'alice', role: 'user' };
    AuthService.verifyAccessToken.mockReturnValue(payload);
    const req = mockReq({ headers: { authorization: 'Bearer good-token' } });
    const res = mockRes();

    await AuthController.validate(req, res);

    expect(AuthService.verifyAccessToken).toHaveBeenCalledWith('good-token');
    expect(res.json).toHaveBeenCalledWith({ valid: true, user: payload });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 {valid:false} when verifyAccessToken throws', async () => {
    AuthService.verifyAccessToken.mockImplementation(() => {
      throw new Error('invalid token');
    });
    const req = mockReq({ headers: { authorization: 'Bearer bad-token' } });
    const res = mockRes();

    await AuthController.validate(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ valid: false });
  });
});
