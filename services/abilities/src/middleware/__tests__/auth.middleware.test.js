jest.mock('jsonwebtoken');

const jwt = require('jsonwebtoken');
const requireAuth = require('../auth.middleware');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

beforeEach(() => jest.clearAllMocks());

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
  jwt.verify.mockReturnValue({ sub: 'u1' });
  const req = { headers: { authorization: 'Bearer good' } };
  const res = mockRes();
  const next = jest.fn();
  requireAuth(req, res, next);
  expect(req.user).toEqual({ sub: 'u1' });
  expect(next).toHaveBeenCalled();
});
