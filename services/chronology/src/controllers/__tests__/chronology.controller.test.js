jest.mock('../../models/chronology.model');

const ChronologyModel = require('../../models/chronology.model');
const ChronologyController = require('../chronology.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ params = {}, query = {}, body = {}, user = { sub: 'user-1', role: 'user' } } = {}) {
  return { params, query, body, user };
}

beforeEach(() => jest.clearAllMocks());

describe('ChronologyController.list', () => {
  it('forwards the user id and admin flag to the model', async () => {
    ChronologyModel.findAll.mockResolvedValue([{ id: 'c1' }]);
    const req = mockReq({ user: { sub: 'user-1', role: 'admin' } });
    const res = mockRes();

    await ChronologyController.list(req, res);

    expect(ChronologyModel.findAll).toHaveBeenCalledWith('user-1', true);
    expect(res.json).toHaveBeenCalledWith({ calendars: [{ id: 'c1' }] });
  });
});

describe('ChronologyController.getOne', () => {
  it('returns 404 when not found or not visible', async () => {
    ChronologyModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await ChronologyController.getOne(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Календар не знайдено' });
  });

  it('returns 200 with the calendar on success', async () => {
    ChronologyModel.findById.mockResolvedValue({ id: 'c1', name: 'Гарія' });
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await ChronologyController.getOne(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ calendar: { id: 'c1', name: 'Гарія' } });
  });
});

describe('ChronologyController.create', () => {
  it('returns 400 when name is missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await ChronologyController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyModel.create).not.toHaveBeenCalled();
  });

  it('creates a calendar owned by the requester', async () => {
    ChronologyModel.create.mockResolvedValue({ id: 'c2', name: 'Гарія' });
    const req = mockReq({ body: { name: 'Гарія' } });
    const res = mockRes();

    await ChronologyController.create(req, res);

    expect(ChronologyModel.create).toHaveBeenCalledWith('user-1', { name: 'Гарія' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ calendar: { id: 'c2', name: 'Гарія' } });
  });
});

describe('ChronologyController.update', () => {
  it('returns 400 when name is missing', async () => {
    const req = mockReq({ params: { id: 'c1' }, body: {} });
    const res = mockRes();

    await ChronologyController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyModel.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the calendar does not exist', async () => {
    ChronologyModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' }, body: { name: 'x' } });
    const res = mockRes();

    await ChronologyController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updates any calendar regardless of ownership (role already gated at route level)', async () => {
    ChronologyModel.update.mockResolvedValue({ id: 'c1', name: 'Нове' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Нове' } });
    const res = mockRes();

    await ChronologyController.update(req, res);

    expect(ChronologyModel.monthBelongsToCalendar).not.toHaveBeenCalled();
    expect(ChronologyModel.update).toHaveBeenCalledWith('c1', { name: 'Нове' });
    expect(res.json).toHaveBeenCalledWith({ calendar: { id: 'c1', name: 'Нове' } });
  });

  it('returns 400 when default_month_id does not belong to this calendar', async () => {
    ChronologyModel.monthBelongsToCalendar.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Нове', default_month_id: 'other-cal-month' } });
    const res = mockRes();

    await ChronologyController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyModel.update).not.toHaveBeenCalled();
  });

  it('updates with default_year/default_month_id once the month is verified', async () => {
    ChronologyModel.monthBelongsToCalendar.mockResolvedValue(true);
    ChronologyModel.update.mockResolvedValue({ id: 'c1', name: 'Нове', default_year: 100, default_month_id: 'm1' });
    const body = { name: 'Нове', default_year: 100, default_month_id: 'm1' };
    const req = mockReq({ params: { id: 'c1' }, body });
    const res = mockRes();

    await ChronologyController.update(req, res);

    expect(ChronologyModel.monthBelongsToCalendar).toHaveBeenCalledWith('m1', 'c1');
    expect(ChronologyModel.update).toHaveBeenCalledWith('c1', body);
  });
});

describe('ChronologyController.remove', () => {
  it('returns 404 when nothing was deleted', async () => {
    ChronologyModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await ChronologyController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 200 with a confirmation message on success', async () => {
    ChronologyModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await ChronologyController.remove(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
