jest.mock('../../models/calendar.model');
jest.mock('../../models/calendar-weekday.model');

const CalendarModel = require('../../models/calendar.model');
const CalendarWeekdayModel = require('../../models/calendar-weekday.model');
const CalendarWeekdayController = require('../calendar-weekday.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ params = {}, body = {}, user = { sub: 'user-1', role: 'game_master' } } = {}) {
  return { params, body, user };
}

beforeEach(() => jest.clearAllMocks());

describe('CalendarWeekdayController.list', () => {
  it('returns 404 when the parent calendar is not visible', async () => {
    CalendarModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await CalendarWeekdayController.list(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('lists weekdays scoped to the calendar', async () => {
    CalendarModel.findById.mockResolvedValue({ id: 'c1' });
    CalendarWeekdayModel.findAllByCalendar.mockResolvedValue([{ id: 'w1' }]);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CalendarWeekdayController.list(req, res);

    expect(CalendarWeekdayModel.findAllByCalendar).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ weekdays: [{ id: 'w1' }] });
  });
});

describe('CalendarWeekdayController.create', () => {
  it('returns 400 when order_num is missing', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Сонцедень' } });
    const res = mockRes();

    await CalendarWeekdayController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(CalendarWeekdayModel.create).not.toHaveBeenCalled();
  });

  it('creates a weekday scoped to the calendar', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    CalendarWeekdayModel.create.mockResolvedValue({ id: 'w1' });
    const body = { name: 'Сонцедень', order_num: 0 };
    const req = mockReq({ params: { id: 'c1' }, body });
    const res = mockRes();

    await CalendarWeekdayController.create(req, res);

    expect(CalendarWeekdayModel.create).toHaveBeenCalledWith('c1', body);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('CalendarWeekdayController.update', () => {
  it('returns 404 when the weekday does not exist for this calendar', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    CalendarWeekdayModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', weekdayId: 'w1' }, body: { name: 'x', order_num: 1 } });
    const res = mockRes();

    await CalendarWeekdayController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
