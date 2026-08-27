jest.mock('../../models/calendar.model');
jest.mock('../../models/calendar-month.model');

const CalendarModel = require('../../models/calendar.model');
const CalendarMonthModel = require('../../models/calendar-month.model');
const CalendarMonthController = require('../calendar-month.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ params = {}, body = {}, user = { sub: 'user-1', role: 'game_master' } } = {}) {
  return { params, body, user };
}

beforeEach(() => jest.clearAllMocks());

describe('CalendarMonthController.list', () => {
  it('returns 404 when the parent calendar is not visible', async () => {
    CalendarModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await CalendarMonthController.list(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(CalendarMonthModel.findAllByCalendar).not.toHaveBeenCalled();
  });

  it('lists months scoped to the calendar', async () => {
    CalendarModel.findById.mockResolvedValue({ id: 'c1' });
    CalendarMonthModel.findAllByCalendar.mockResolvedValue([{ id: 'm1' }]);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CalendarMonthController.list(req, res);

    expect(CalendarMonthModel.findAllByCalendar).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ months: [{ id: 'm1' }] });
  });
});

describe('CalendarMonthController.create', () => {
  it('returns 404 when the parent calendar does not exist (existence-only load)', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' }, body: { name: 'x', length: 30, order_num: 1 } });
    const res = mockRes();

    await CalendarMonthController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when length is not positive', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'x', length: 0, order_num: 1 } });
    const res = mockRes();

    await CalendarMonthController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(CalendarMonthModel.create).not.toHaveBeenCalled();
  });

  it('creates a month scoped to the calendar', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    CalendarMonthModel.create.mockResolvedValue({ id: 'm1', name: 'Первоцвіт' });
    const body = { name: 'Первоцвіт', length: 30, order_num: 1 };
    const req = mockReq({ params: { id: 'c1' }, body });
    const res = mockRes();

    await CalendarMonthController.create(req, res);

    expect(CalendarMonthModel.create).toHaveBeenCalledWith('c1', body);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('CalendarMonthController.remove', () => {
  it('returns 404 when nothing was deleted', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    CalendarMonthModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', monthId: 'm1' } });
    const res = mockRes();

    await CalendarMonthController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deletes the month scoped to the calendar', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    CalendarMonthModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', monthId: 'm1' } });
    const res = mockRes();

    await CalendarMonthController.remove(req, res);

    expect(CalendarMonthModel.delete).toHaveBeenCalledWith('m1', 'c1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
