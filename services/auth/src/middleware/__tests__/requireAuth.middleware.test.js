jest.mock('../../services/auth.service');

const AuthService = require('../../services/auth.service');
const requireAuth = require('../requireAuth.middleware');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('requireAuth middleware', () => {
  it('returns 401 when the Authorization header is missing', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the header is not a Bearer token', () => {
    const req = { headers: { authorization: 'Basic xyz' } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token verification throws', () => {
    AuthService.verifyAccessToken.mockImplementation(() => { throw new Error('bad'); });
    const req = { headers: { authorization: 'Bearer bad-token' } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches req.user and calls next on a valid token', () => {
    AuthService.verifyAccessToken.mockReturnValue({ sub: 'u1', role: 'player' });
    const req = { headers: { authorization: 'Bearer good-token' } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(req.user).toEqual({ sub: 'u1', role: 'player' });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
