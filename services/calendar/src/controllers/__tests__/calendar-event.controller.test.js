jest.mock('../../models/calendar.model');
jest.mock('../../models/calendar-event.model');

const CalendarModel = require('../../models/calendar.model');
const CalendarEventModel = require('../../models/calendar-event.model');
const CalendarEventController = require('../calendar-event.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ params = {}, query = {}, body = {}, user = { sub: 'user-1', role: 'game_master' } } = {}) {
  return { params, query, body, user };
}

beforeEach(() => jest.clearAllMocks());

describe('CalendarEventController.list', () => {
  it('returns 404 when the parent calendar is not visible', async () => {
    CalendarModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await CalendarEventController.list(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forwards campaign_id from the query string and includePrivate for managers', async () => {
    CalendarModel.findById.mockResolvedValue({ id: 'c1' });
    CalendarEventModel.findAllByCalendar.mockResolvedValue([{ id: 'e1' }]);
    const req = mockReq({ params: { id: 'c1' }, query: { campaign_id: 'camp-1' }, user: { sub: 'u1', role: 'game_master' } });
    const res = mockRes();

    await CalendarEventController.list(req, res);

    expect(CalendarEventModel.findAllByCalendar).toHaveBeenCalledWith('c1', { campaignId: 'camp-1', includePrivate: true });
    expect(res.json).toHaveBeenCalledWith({ events: [{ id: 'e1' }] });
  });

  it('does not grant includePrivate to a regular user', async () => {
    CalendarModel.findById.mockResolvedValue({ id: 'c1' });
    CalendarEventModel.findAllByCalendar.mockResolvedValue([]);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'u1', role: 'user' } });
    const res = mockRes();

    await CalendarEventController.list(req, res);

    expect(CalendarEventModel.findAllByCalendar).toHaveBeenCalledWith('c1', { campaignId: undefined, includePrivate: false });
  });
});

describe('CalendarEventController.create', () => {
  it('returns 400 on an invalid hex color', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Битва', color: 'red' } });
    const res = mockRes();

    await CalendarEventController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(CalendarEventModel.create).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid recurrence value', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Битва', color: '#ff0000', recurrence: 'daily' } });
    const res = mockRes();

    await CalendarEventController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(CalendarEventModel.create).not.toHaveBeenCalled();
  });

  it('returns 400 when month_id does not belong to this calendar', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    CalendarEventModel.monthBelongsToCalendar.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Битва', color: '#ff0000', month_id: 'other-month' } });
    const res = mockRes();

    await CalendarEventController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(CalendarEventModel.create).not.toHaveBeenCalled();
  });

  it('skips the month check when month_id is not provided (unpinned event)', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    CalendarEventModel.create.mockResolvedValue({ id: 'e1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Легенда', color: '#ff0000' } });
    const res = mockRes();

    await CalendarEventController.create(req, res);

    expect(CalendarEventModel.monthBelongsToCalendar).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('creates a global event scoped to the calendar once validation passes', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    CalendarEventModel.monthBelongsToCalendar.mockResolvedValue(true);
    CalendarEventModel.create.mockResolvedValue({ id: 'e1' });
    const body = { name: 'Заснування міста', color: '#4caf50', month_id: 'm1', year: 100, day: 1 };
    const req = mockReq({ params: { id: 'c1' }, body });
    const res = mockRes();

    await CalendarEventController.create(req, res);

    expect(CalendarEventModel.create).toHaveBeenCalledWith('c1', body);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('CalendarEventController.update', () => {
  it('returns 404 when the event does not exist for this calendar', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    CalendarEventModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', eventId: 'e1' }, body: { name: 'x', color: '#000000' } });
    const res = mockRes();

    await CalendarEventController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('CalendarEventController.remove', () => {
  it('returns 404 when nothing was deleted', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    CalendarEventModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', eventId: 'e1' } });
    const res = mockRes();

    await CalendarEventController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deletes the event scoped to the calendar', async () => {
    CalendarModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    CalendarEventModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', eventId: 'e1' } });
    const res = mockRes();

    await CalendarEventController.remove(req, res);

    expect(CalendarEventModel.delete).toHaveBeenCalledWith('e1', 'c1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
