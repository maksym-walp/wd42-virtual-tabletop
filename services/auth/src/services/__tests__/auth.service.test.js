jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../models/user.model');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../../models/user.model');
const AuthService = require('../auth.service');

const USER = {
  id: 'u1',
  email: 'a@b.com',
  username: 'alice',
  role: 'player',
  password_hash: 'hashed',
  is_active: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  jwt.sign.mockReturnValue('signed-token');
});

describe('register', () => {
  it('rejects a duplicate email with 409', async () => {
    UserModel.findByEmail.mockResolvedValue(USER);
    await expect(AuthService.register({ email: 'a@b.com', username: 'x', password: 'pw' }))
      .rejects.toMatchObject({ statusCode: 409, message: 'Email already in use' });
  });

  it('rejects a duplicate username with 409', async () => {
    UserModel.findByEmail.mockResolvedValue(null);
    UserModel.findByUsername.mockResolvedValue(USER);
    await expect(AuthService.register({ email: 'new@b.com', username: 'alice', password: 'pw' }))
      .rejects.toMatchObject({ statusCode: 409, message: 'Username already taken' });
  });

  it('hashes the password with cost factor 12 and persists a hashed refresh token', async () => {
    UserModel.findByEmail.mockResolvedValue(null);
    UserModel.findByUsername.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed-pw');
    UserModel.create.mockResolvedValue(USER);

    const result = await AuthService.register({ email: 'a@b.com', username: 'alice', password: 'plain-pw' });

    expect(bcrypt.hash).toHaveBeenCalledWith('plain-pw', 12);
    expect(UserModel.saveRefreshToken).toHaveBeenCalledWith(
      USER.id,
      expect.any(String),
      expect.any(Date)
    );
    // the persisted token must be a hash, not the raw signed token
    expect(UserModel.saveRefreshToken.mock.calls[0][1]).not.toBe('signed-token');
    expect(result).toEqual({ user: USER, accessToken: 'signed-token', refreshToken: 'signed-token' });
  });
});

describe('login', () => {
  it('fails with a generic message when the email is unknown (no user enumeration)', async () => {
    UserModel.findByEmail.mockResolvedValue(null);
    await expect(AuthService.login({ email: 'nope@b.com', password: 'pw' }))
      .rejects.toMatchObject({ statusCode: 401, message: 'Invalid credentials' });
  });

  it('fails with the same generic message when the password is wrong', async () => {
    UserModel.findByEmail.mockResolvedValue(USER);
    bcrypt.compare.mockResolvedValue(false);
    await expect(AuthService.login({ email: 'a@b.com', password: 'wrong' }))
      .rejects.toMatchObject({ statusCode: 401, message: 'Invalid credentials' });
  });

  it('returns a sanitized user (no password_hash) on success', async () => {
    UserModel.findByEmail.mockResolvedValue(USER);
    bcrypt.compare.mockResolvedValue(true);

    const result = await AuthService.login({ email: 'a@b.com', password: 'pw' });

    expect(result.user).toEqual({ id: USER.id, email: USER.email, username: USER.username, role: USER.role });
    expect(result.user.password_hash).toBeUndefined();
  });
});

describe('refresh', () => {
  it('rejects an invalid/expired refresh token with 401', async () => {
    jwt.verify.mockImplementation(() => { throw new Error('bad token'); });
    await expect(AuthService.refresh('bad')).rejects.toMatchObject({ statusCode: 401, message: 'Invalid refresh token' });
  });

  it('rejects a revoked/unknown refresh token with 401', async () => {
    jwt.verify.mockReturnValue({ sub: 'u1' });
    UserModel.findRefreshToken.mockResolvedValue(null);
    await expect(AuthService.refresh('tok')).rejects.toMatchObject({ statusCode: 401, message: 'Refresh token revoked or expired' });
  });

  it('rejects when the user is missing or inactive', async () => {
    jwt.verify.mockReturnValue({ sub: 'u1' });
    UserModel.findRefreshToken.mockResolvedValue({ token_hash: 'x' });
    UserModel.findById.mockResolvedValue({ ...USER, is_active: false });
    await expect(AuthService.refresh('tok')).rejects.toMatchObject({ statusCode: 401, message: 'User not found or inactive' });
  });

  it('returns only a new access token, without rotating the refresh token', async () => {
    jwt.verify.mockReturnValue({ sub: 'u1' });
    UserModel.findRefreshToken.mockResolvedValue({ token_hash: 'x' });
    UserModel.findById.mockResolvedValue(USER);

    const result = await AuthService.refresh('tok');

    expect(result).toEqual({ accessToken: 'signed-token' });
    expect(UserModel.saveRefreshToken).not.toHaveBeenCalled();
  });
});

describe('logout', () => {
  it('is a no-op when userId or refreshToken is missing', async () => {
    await AuthService.logout(null, 'tok');
    await AuthService.logout('u1', null);
    expect(UserModel.deleteRefreshToken).not.toHaveBeenCalled();
  });

  it('deletes the hashed refresh token when both args are present', async () => {
    await AuthService.logout('u1', 'tok');
    expect(UserModel.deleteRefreshToken).toHaveBeenCalledWith('u1', expect.any(String));
  });
});

describe('verifyAccessToken', () => {
  it('delegates to jwt.verify', () => {
    jwt.verify.mockReturnValue({ sub: 'u1' });
    expect(AuthService.verifyAccessToken('tok')).toEqual({ sub: 'u1' });
    expect(jwt.verify).toHaveBeenCalledWith('tok', process.env.JWT_ACCESS_SECRET);
  });
});

describe('hashToken', () => {
  it('is deterministic for the same input', () => {
    expect(AuthService.hashToken('abc')).toBe(AuthService.hashToken('abc'));
    expect(AuthService.hashToken('abc')).not.toBe(AuthService.hashToken('abd'));
  });
});

describe('refreshTokenExpiryDate', () => {
  const OLD_ENV = process.env.JWT_REFRESH_EXPIRES;
  afterEach(() => { process.env.JWT_REFRESH_EXPIRES = OLD_ENV; });

  it.each([
    ['15m', 15 * 60 * 1000],
    ['7d', 7 * 86400 * 1000],
    ['3600s', 3600 * 1000],
  ])('parses %s correctly', (value, expectedMs) => {
    // auth.service.js reads REFRESH_EXPIRES once at module load, so we test
    // the exported function's behavior relative to the already-loaded env.
    jest.resetModules();
    process.env.JWT_REFRESH_EXPIRES = value;
    const svc = require('../auth.service');
    const before = Date.now();
    const date = svc.refreshTokenExpiryDate();
    expect(date.getTime() - before).toBeGreaterThanOrEqual(expectedMs - 1000);
    expect(date.getTime() - before).toBeLessThanOrEqual(expectedMs + 1000);
  });

  it('falls back to 7 days for a garbage value', () => {
    jest.resetModules();
    process.env.JWT_REFRESH_EXPIRES = 'garbage';
    const svc = require('../auth.service');
    const before = Date.now();
    const date = svc.refreshTokenExpiryDate();
    const sevenDaysMs = 7 * 86400 * 1000;
    expect(date.getTime() - before).toBeGreaterThanOrEqual(sevenDaysMs - 1000);
    expect(date.getTime() - before).toBeLessThanOrEqual(sevenDaysMs + 1000);
  });
});
