jest.mock('../../models/chronology.model');
jest.mock('../../models/chronology-month.model');

const ChronologyModel = require('../../models/chronology.model');
const ChronologyMonthModel = require('../../models/chronology-month.model');
const ChronologyMonthController = require('../chronology-month.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ params = {}, body = {}, user = { sub: 'user-1', role: 'game_master' } } = {}) {
  return { params, body, user };
}

beforeEach(() => jest.clearAllMocks());

describe('ChronologyMonthController.list', () => {
  it('returns 404 when the parent calendar is not visible', async () => {
    ChronologyModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await ChronologyMonthController.list(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(ChronologyMonthModel.findAllByCalendar).not.toHaveBeenCalled();
  });

  it('lists months scoped to the calendar', async () => {
    ChronologyModel.findById.mockResolvedValue({ id: 'c1' });
    ChronologyMonthModel.findAllByCalendar.mockResolvedValue([{ id: 'm1' }]);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await ChronologyMonthController.list(req, res);

    expect(ChronologyMonthModel.findAllByCalendar).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ months: [{ id: 'm1' }] });
  });
});

describe('ChronologyMonthController.create', () => {
  it('returns 404 when the parent calendar does not exist (existence-only load)', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' }, body: { name: 'x', length: 30, order_num: 1 } });
    const res = mockRes();

    await ChronologyMonthController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when length is not positive', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'x', length: 0, order_num: 1 } });
    const res = mockRes();

    await ChronologyMonthController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyMonthModel.create).not.toHaveBeenCalled();
  });

  it('creates a month scoped to the calendar', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyMonthModel.create.mockResolvedValue({ id: 'm1', name: 'Первоцвіт' });
    const body = { name: 'Первоцвіт', length: 30, order_num: 1 };
    const req = mockReq({ params: { id: 'c1' }, body });
    const res = mockRes();

    await ChronologyMonthController.create(req, res);

    expect(ChronologyMonthModel.create).toHaveBeenCalledWith('c1', body);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('ChronologyMonthController.remove', () => {
  it('returns 404 when nothing was deleted', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyMonthModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', monthId: 'm1' } });
    const res = mockRes();

    await ChronologyMonthController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deletes the month scoped to the calendar', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyMonthModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', monthId: 'm1' } });
    const res = mockRes();

    await ChronologyMonthController.remove(req, res);

    expect(ChronologyMonthModel.delete).toHaveBeenCalledWith('m1', 'c1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
