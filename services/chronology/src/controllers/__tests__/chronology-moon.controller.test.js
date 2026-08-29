jest.mock('../../models/chronology.model');
jest.mock('../../models/chronology-moon.model');

const ChronologyModel = require('../../models/chronology.model');
const ChronologyMoonModel = require('../../models/chronology-moon.model');
const ChronologyMoonController = require('../chronology-moon.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ params = {}, body = {}, user = { sub: 'user-1', role: 'admin' } } = {}) {
  return { params, body, user };
}

beforeEach(() => jest.clearAllMocks());

describe('ChronologyMoonController.create', () => {
  it('returns 400 when cycle_length is not positive', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Селена', cycle_length: 0, color: '#dddddd' } });
    const res = mockRes();

    await ChronologyMoonController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyMoonModel.create).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid hex color', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Селена', cycle_length: 29.5, color: 'red' } });
    const res = mockRes();

    await ChronologyMoonController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyMoonModel.create).not.toHaveBeenCalled();
  });

  it('creates a moon scoped to the calendar', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyMoonModel.create.mockResolvedValue({ id: 'mo1' });
    const body = { name: 'Селена', cycle_length: 29.5, color: '#dddddd' };
    const req = mockReq({ params: { id: 'c1' }, body });
    const res = mockRes();

    await ChronologyMoonController.create(req, res);

    expect(ChronologyMoonModel.create).toHaveBeenCalledWith('c1', body);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('ChronologyMoonController.remove', () => {
  it('returns 404 when nothing was deleted', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyMoonModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', moonId: 'mo1' } });
    const res = mockRes();

    await ChronologyMoonController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
