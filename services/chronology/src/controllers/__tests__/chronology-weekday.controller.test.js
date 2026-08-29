jest.mock('../../models/chronology.model');
jest.mock('../../models/chronology-weekday.model');

const ChronologyModel = require('../../models/chronology.model');
const ChronologyWeekdayModel = require('../../models/chronology-weekday.model');
const ChronologyWeekdayController = require('../chronology-weekday.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ params = {}, body = {}, user = { sub: 'user-1', role: 'game_master' } } = {}) {
  return { params, body, user };
}

beforeEach(() => jest.clearAllMocks());

describe('ChronologyWeekdayController.list', () => {
  it('returns 404 when the parent calendar is not visible', async () => {
    ChronologyModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await ChronologyWeekdayController.list(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('lists weekdays scoped to the calendar', async () => {
    ChronologyModel.findById.mockResolvedValue({ id: 'c1' });
    ChronologyWeekdayModel.findAllByCalendar.mockResolvedValue([{ id: 'w1' }]);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await ChronologyWeekdayController.list(req, res);

    expect(ChronologyWeekdayModel.findAllByCalendar).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ weekdays: [{ id: 'w1' }] });
  });
});

describe('ChronologyWeekdayController.create', () => {
  it('returns 400 when order_num is missing', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Сонцедень' } });
    const res = mockRes();

    await ChronologyWeekdayController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyWeekdayModel.create).not.toHaveBeenCalled();
  });

  it('creates a weekday scoped to the calendar', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyWeekdayModel.create.mockResolvedValue({ id: 'w1' });
    const body = { name: 'Сонцедень', order_num: 0 };
    const req = mockReq({ params: { id: 'c1' }, body });
    const res = mockRes();

    await ChronologyWeekdayController.create(req, res);

    expect(ChronologyWeekdayModel.create).toHaveBeenCalledWith('c1', body);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('ChronologyWeekdayController.update', () => {
  it('returns 404 when the weekday does not exist for this calendar', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyWeekdayModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', weekdayId: 'w1' }, body: { name: 'x', order_num: 1 } });
    const res = mockRes();

    await ChronologyWeekdayController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
