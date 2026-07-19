jest.mock('../../formula');
jest.mock('../../models/roll.model');

const formula = require('../../formula');
const RollModel = require('../../models/roll.model');
const RollController = require('../roll.controller');
const { FormulaError } = require('../../formula/errors');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ body = {}, query = {}, user = { sub: 'user-1' } } = {}) {
  return { body, query, user };
}

beforeEach(() => jest.clearAllMocks());

describe('RollController.create', () => {
  it('returns 400 when formula is missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await RollController.create(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(formula.rollFormula).not.toHaveBeenCalled();
    expect(RollModel.create).not.toHaveBeenCalled();
  });

  it('returns 400 when formula is not a string', async () => {
    const req = mockReq({ body: { formula: 123 } });
    const res = mockRes();
    await RollController.create(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(formula.rollFormula).not.toHaveBeenCalled();
  });

  it('rolls the formula, persists it and returns 201 with the saved roll', async () => {
    const rolled = { formula: '2d20', total: 15, groups: [] };
    formula.rollFormula.mockReturnValue(rolled);
    RollModel.create.mockResolvedValue({ id: 'roll-1', ...rolled });

    const req = mockReq({ body: { formula: '2d20' } });
    const res = mockRes();
    await RollController.create(req, res);

    expect(formula.rollFormula).toHaveBeenCalledWith('2d20');
    expect(RollModel.create).toHaveBeenCalledWith('user-1', rolled);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ roll: { id: 'roll-1', ...rolled } });
  });

  it('propagates a FormulaError thrown by the formula engine instead of handling it', async () => {
    const err = new FormulaError('Формула не може бути порожньою');
    formula.rollFormula.mockImplementation(() => {
      throw err;
    });

    const req = mockReq({ body: { formula: 'garbage' } });
    const res = mockRes();

    await expect(RollController.create(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Формула не може бути порожньою',
    });
    expect(RollModel.create).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('RollController.list', () => {
  it('defaults limit to 20 and offset to 0 when the query is empty', async () => {
    RollModel.findHistory.mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await RollController.list(req, res);
    expect(RollModel.findHistory).toHaveBeenCalledWith('user-1', { limit: 20, offset: 0 });
  });

  it('clamps an oversized limit to 100', async () => {
    RollModel.findHistory.mockResolvedValue([]);
    const req = mockReq({ query: { limit: '9999' } });
    const res = mockRes();
    await RollController.list(req, res);
    expect(RollModel.findHistory).toHaveBeenCalledWith('user-1', { limit: 100, offset: 0 });
  });

  it('passes through a limit/offset within bounds', async () => {
    RollModel.findHistory.mockResolvedValue([]);
    const req = mockReq({ query: { limit: '5', offset: '10' } });
    const res = mockRes();
    await RollController.list(req, res);
    expect(RollModel.findHistory).toHaveBeenCalledWith('user-1', { limit: 5, offset: 10 });
  });

  it('falls back to defaults when limit/offset are non-numeric', async () => {
    RollModel.findHistory.mockResolvedValue([]);
    const req = mockReq({ query: { limit: 'abc', offset: 'xyz' } });
    const res = mockRes();
    await RollController.list(req, res);
    expect(RollModel.findHistory).toHaveBeenCalledWith('user-1', { limit: 20, offset: 0 });
  });

  it('returns the rolls from the model', async () => {
    const rolls = [{ id: 'r1' }, { id: 'r2' }];
    RollModel.findHistory.mockResolvedValue(rolls);
    const req = mockReq();
    const res = mockRes();
    await RollController.list(req, res);
    expect(res.json).toHaveBeenCalledWith({ rolls });
  });
});

describe('RollController.stats', () => {
  it('delegates to RollModel.getStats and returns its result', async () => {
    const stats = { total_rolls: 3, nat20_count: 1 };
    RollModel.getStats.mockResolvedValue(stats);
    const req = mockReq();
    const res = mockRes();
    await RollController.stats(req, res);
    expect(RollModel.getStats).toHaveBeenCalledWith('user-1');
    expect(res.json).toHaveBeenCalledWith({ stats });
  });
});
