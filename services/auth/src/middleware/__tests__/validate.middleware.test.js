jest.mock('express-validator');

const { validationResult } = require('express-validator');
const validate = require('../validate.middleware');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function fakeValidation() {
  return { run: jest.fn().mockResolvedValue(undefined) };
}

beforeEach(() => jest.clearAllMocks());

describe('validate middleware', () => {
  it('runs every validation and calls next() with no args when there are no errors', async () => {
    validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });
    const v1 = fakeValidation();
    const v2 = fakeValidation();
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    const middleware = validate([v1, v2]);
    await middleware(req, res, next);

    expect(v1.run).toHaveBeenCalledWith(req);
    expect(v2.run).toHaveBeenCalledWith(req);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('responds 400 with the error array and does not call next() when validation fails', async () => {
    const errors = [{ msg: 'Valid email required', param: 'email' }];
    validationResult.mockReturnValue({ isEmpty: () => false, array: () => errors });
    const v1 = fakeValidation();
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    const middleware = validate([v1]);
    await middleware(req, res, next);

    expect(v1.run).toHaveBeenCalledWith(req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ errors });
    expect(next).not.toHaveBeenCalled();
  });
});
