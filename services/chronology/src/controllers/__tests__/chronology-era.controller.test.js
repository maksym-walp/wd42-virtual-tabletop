jest.mock('../../models/chronology.model');
jest.mock('../../models/chronology-era.model');

const ChronologyModel = require('../../models/chronology.model');
const ChronologyEraModel = require('../../models/chronology-era.model');
const ChronologyEraController = require('../chronology-era.controller');

const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const mockReq = ({ params = {}, body = {} } = {}) => ({ params, body, user: { sub: 'u1', role: 'game_master' } });
const valid = { name: 'Ера Попелу', start_year: 500, start_month_id: 'm1', start_day: 3 };

beforeEach(() => {
  jest.clearAllMocks();
  ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
  ChronologyEraModel.monthLengthInCalendar.mockResolvedValue(30);
});

describe('ChronologyEraController.create', () => {
  it.each([
    ['no name', { ...valid, name: '' }],
    ['non-integer year', { ...valid, start_year: 1.5 }],
    ['non-positive day', { ...valid, start_day: 0 }],
    ['zero cycle', { ...valid, cycle_years: 0 }],
    ['fractional cycle', { ...valid, cycle_years: 2.5 }],
  ])('400s on %s', async (_label, body) => {
    const res = mockRes();
    await ChronologyEraController.create(mockReq({ params: { id: 'c1' }, body }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyEraModel.create).not.toHaveBeenCalled();
  });

  it('400s when the start month belongs to another calendar', async () => {
    ChronologyEraModel.monthLengthInCalendar.mockResolvedValue(null);
    const res = mockRes();
    await ChronologyEraController.create(mockReq({ params: { id: 'c1' }, body: valid }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400s when the start day does not fit in the month', async () => {
    const res = mockRes();
    await ChronologyEraController.create(mockReq({ params: { id: 'c1' }, body: { ...valid, start_day: 31 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates a cyclic era', async () => {
    ChronologyEraModel.create.mockResolvedValue({ id: 'e1' });
    const res = mockRes();
    const body = { ...valid, cycle_years: 60 };
    await ChronologyEraController.create(mockReq({ params: { id: 'c1' }, body }), res);
    expect(ChronologyEraModel.create).toHaveBeenCalledWith('c1', body);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('ChronologyEraController.update/remove', () => {
  it('404s on an unknown era', async () => {
    ChronologyEraModel.update.mockResolvedValue(null);
    const res = mockRes();
    await ChronologyEraController.update(mockReq({ params: { id: 'c1', eraId: 'x' }, body: valid }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    ChronologyEraModel.delete.mockResolvedValue(false);
    const res2 = mockRes();
    await ChronologyEraController.remove(mockReq({ params: { id: 'c1', eraId: 'x' } }), res2);
    expect(res2.status).toHaveBeenCalledWith(404);
  });
});
