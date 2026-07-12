jest.mock('jsonwebtoken');

const jwt = require('jsonwebtoken');
const { requireAuth, requireGameMaster } = require('../auth.middleware');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

beforeEach(() => jest.clearAllMocks());

describe('requireAuth', () => {
  it('rejects a missing Authorization header', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when jwt.verify throws', () => {
    jwt.verify.mockImplementation(() => { throw new Error('bad'); });
    const req = { headers: { authorization: 'Bearer bad' } };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches req.user and calls next on success', () => {
    jwt.verify.mockReturnValue({ sub: 'u1', role: 'player' });
    const req = { headers: { authorization: 'Bearer good' } };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(req.user).toEqual({ sub: 'u1', role: 'player' });
    expect(next).toHaveBeenCalled();
  });
});

describe('requireGameMaster', () => {
  it('returns 403 for a non-GM user', () => {
    jwt.verify.mockReturnValue({ sub: 'u1', role: 'player' });
    const req = { headers: { authorization: 'Bearer good' } };
    const res = mockRes();
    const next = jest.fn();
    requireGameMaster(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next for a game_master user', () => {
    jwt.verify.mockReturnValue({ sub: 'u1', role: 'game_master' });
    const req = { headers: { authorization: 'Bearer good' } };
    const res = mockRes();
    const next = jest.fn();
    requireGameMaster(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects with 401 (not 403) when the token itself is invalid', () => {
    jwt.verify.mockImplementation(() => { throw new Error('bad'); });
    const req = { headers: { authorization: 'Bearer bad' } };
    const res = mockRes();
    const next = jest.fn();
    requireGameMaster(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
