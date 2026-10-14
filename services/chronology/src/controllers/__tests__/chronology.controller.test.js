jest.mock('../../models/chronology.model');
jest.mock('../../models/chronology-month.model');
jest.mock('../../models/chronology-weekday.model');
jest.mock('../../models/chronology-season.model');
jest.mock('../../models/chronology-moon.model');
jest.mock('../../models/chronology-era.model');

const ChronologyModel = require('../../models/chronology.model');
const ChronologyMonthModel = require('../../models/chronology-month.model');
const ChronologyWeekdayModel = require('../../models/chronology-weekday.model');
const ChronologySeasonModel = require('../../models/chronology-season.model');
const ChronologyMoonModel = require('../../models/chronology-moon.model');
const ChronologyEraModel = require('../../models/chronology-era.model');
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

describe('ChronologyController.setDefault', () => {
  it('rejects a non-boolean is_default', async () => {
    const res = mockRes();
    await ChronologyController.setDefault(mockReq({ params: { id: 'c1' }, body: { is_default: 'yes' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyModel.setDefault).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown calendar', async () => {
    ChronologyModel.setDefault.mockResolvedValue(null);
    const res = mockRes();
    await ChronologyController.setDefault(mockReq({ params: { id: 'x' }, body: { is_default: true } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns the updated calendar', async () => {
    ChronologyModel.setDefault.mockResolvedValue({ id: 'c1', is_default: true });
    const res = mockRes();
    await ChronologyController.setDefault(mockReq({ params: { id: 'c1' }, body: { is_default: true } }), res);
    expect(ChronologyModel.setDefault).toHaveBeenCalledWith('c1', true);
    expect(res.json).toHaveBeenCalledWith({ calendar: { id: 'c1', is_default: true } });
  });
});

describe('ChronologyController.exportStructure', () => {
  it('returns 404 for a missing or invisible calendar', async () => {
    ChronologyModel.findById.mockResolvedValue(null);
    const res = mockRes();
    await ChronologyController.exportStructure(mockReq({ params: { id: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('responds with the structure only, no events', async () => {
    ChronologyModel.findById.mockResolvedValue({ id: 'c1', default_year: null, first_day_offset: 0 });
    ChronologyMonthModel.findAllByCalendar.mockResolvedValue([{ id: 'm1', name: 'A', length: 30 }]);
    ChronologyWeekdayModel.findAllByCalendar.mockResolvedValue([{ name: 'Пн' }]);
    ChronologySeasonModel.findAllByCalendar.mockResolvedValue([]);
    ChronologyMoonModel.findAllByCalendar.mockResolvedValue([{ name: 'M', cycle_length: 28, shift: 3 }]);
    ChronologyEraModel.findAllByCalendar.mockResolvedValue([]);
    const res = mockRes();
    await ChronologyController.exportStructure(mockReq({ params: { id: 'c1' } }), res);
    const body = res.json.mock.calls[0][0];
    expect(body).toMatchObject({ year_len: 30, n_months: 1, months: ['A'], week_len: 1, moons: ['M'], lunar_shf: { M: 3 } });
    expect(body).not.toHaveProperty('calendar_events');
  });
});

describe('ChronologyController.update terms', () => {
  it('rejects a term longer than 50 characters', async () => {
    const res = mockRes();
    await ChronologyController.update(mockReq({ params: { id: 'c1' }, body: { name: 'K', term_year: 'x'.repeat(51) } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyModel.update).not.toHaveBeenCalled();
  });
});

describe('ChronologyController.setSync', () => {
  const call = (body, params = { id: 'c2' }) => {
    const res = mockRes();
    return ChronologyController.setSync(mockReq({ params, body }), res).then(() => res);
  };

  it('rejects a non-integer offset', async () => {
    const res = await call({ sync_offset_days: 1.5 });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyModel.setSyncOffset).not.toHaveBeenCalled();
  });

  it('404s for an unknown calendar', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue(null);
    const res = await call({ sync_offset_days: 3 });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('refuses to sync the default calendar itself', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1', is_default: true });
    const res = await call({ sync_offset_days: 3 }, { id: 'c1' });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('refuses to sync while no default calendar exists, but allows clearing', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c2', is_default: false });
    ChronologyModel.hasDefault.mockResolvedValue(false);
    let res = await call({ sync_offset_days: 3 });
    expect(res.status).toHaveBeenCalledWith(400);
    ChronologyModel.setSyncOffset.mockResolvedValue({ id: 'c2', sync_offset_days: null });
    res = await call({ sync_offset_days: null });
    expect(ChronologyModel.setSyncOffset).toHaveBeenCalledWith('c2', null);
  });

  it('stores the offset', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c2', is_default: false });
    ChronologyModel.hasDefault.mockResolvedValue(true);
    ChronologyModel.setSyncOffset.mockResolvedValue({ id: 'c2', sync_offset_days: -12 });
    const res = await call({ sync_offset_days: -12 });
    expect(ChronologyModel.setSyncOffset).toHaveBeenCalledWith('c2', -12);
    expect(res.json).toHaveBeenCalledWith({ calendar: { id: 'c2', sync_offset_days: -12 } });
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
