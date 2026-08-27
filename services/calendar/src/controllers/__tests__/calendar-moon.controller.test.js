jest.mock('../../models/calendar.model');
jest.mock('../../models/calendar-moon.model');

const CalendarModel = require('../../models/calendar.model');
const CalendarMoonModel = require('../../models/calendar-moon.model');
const CalendarMoonController = require('../calendar-moon.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ params = {}, body = {}, user = { sub: 'user-1', role: 'admin' } } = {}) {
  return { params, body, user };
}

beforeEach(() => jest.clearAllMocks());

describe('CalendarMoonController.create', () => {
  it('returns 400 when cycle_length is not positive', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Селена', cycle_length: 0, color: '#dddddd' } });
    const res = mockRes();

    await CalendarMoonController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(CalendarMoonModel.create).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid hex color', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Селена', cycle_length: 29.5, color: 'red' } });
    const res = mockRes();

    await CalendarMoonController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(CalendarMoonModel.create).not.toHaveBeenCalled();
  });

  it('creates a moon scoped to the calendar', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    CalendarMoonModel.create.mockResolvedValue({ id: 'mo1' });
    const body = { name: 'Селена', cycle_length: 29.5, color: '#dddddd' };
    const req = mockReq({ params: { id: 'c1' }, body });
    const res = mockRes();

    await CalendarMoonController.create(req, res);

    expect(CalendarMoonModel.create).toHaveBeenCalledWith('c1', body);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('CalendarMoonController.remove', () => {
  it('returns 404 when nothing was deleted', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    CalendarMoonModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', moonId: 'mo1' } });
    const res = mockRes();

    await CalendarMoonController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
