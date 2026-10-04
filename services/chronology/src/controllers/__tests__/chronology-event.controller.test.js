jest.mock('../../models/chronology.model');
jest.mock('../../models/chronology-event.model');

const ChronologyModel = require('../../models/chronology.model');
const ChronologyEventModel = require('../../models/chronology-event.model');
const ChronologyEventController = require('../chronology-event.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ params = {}, query = {}, body = {}, user = { sub: 'user-1', role: 'game_master' } } = {}) {
  return { params, query, body, user };
}

beforeEach(() => jest.clearAllMocks());

describe('ChronologyEventController.list', () => {
  it('returns 404 when the parent calendar is not visible', async () => {
    ChronologyModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await ChronologyEventController.list(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forwards campaign_id from the query string and includePrivate for managers', async () => {
    ChronologyModel.findById.mockResolvedValue({ id: 'c1' });
    ChronologyEventModel.findAllByCalendar.mockResolvedValue([{ id: 'e1' }]);
    const req = mockReq({ params: { id: 'c1' }, query: { campaign_id: 'camp-1' }, user: { sub: 'u1', role: 'game_master' } });
    const res = mockRes();

    await ChronologyEventController.list(req, res);

    expect(ChronologyEventModel.findAllByCalendar).toHaveBeenCalledWith('c1', { campaignId: 'camp-1', includePrivate: true });
    expect(res.json).toHaveBeenCalledWith({ events: [{ id: 'e1' }] });
  });

  it('does not grant includePrivate to a regular user', async () => {
    ChronologyModel.findById.mockResolvedValue({ id: 'c1' });
    ChronologyEventModel.findAllByCalendar.mockResolvedValue([]);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'u1', role: 'user' } });
    const res = mockRes();

    await ChronologyEventController.list(req, res);

    expect(ChronologyEventModel.findAllByCalendar).toHaveBeenCalledWith('c1', { campaignId: undefined, includePrivate: false });
  });
});

describe('ChronologyEventController.create', () => {
  it('returns 400 on an invalid hex color', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Битва', color: 'red' } });
    const res = mockRes();

    await ChronologyEventController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyEventModel.create).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid recurrence value', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Битва', color: '#ff0000', recurrence: 'daily' } });
    const res = mockRes();

    await ChronologyEventController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyEventModel.create).not.toHaveBeenCalled();
  });

  it('returns 400 when month_id does not belong to this calendar', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyEventModel.monthBelongsToCalendar.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Битва', color: '#ff0000', month_id: 'other-month' } });
    const res = mockRes();

    await ChronologyEventController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyEventModel.create).not.toHaveBeenCalled();
  });

  it('returns 400 when end_month_id does not belong to this calendar', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyEventModel.monthBelongsToCalendar.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const req = mockReq({
      params: { id: 'c1' },
      body: { name: 'Облога', color: '#ff0000', month_id: 'm1', end_month_id: 'other-month' },
    });
    const res = mockRes();

    await ChronologyEventController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyEventModel.create).not.toHaveBeenCalled();
  });

  it('returns 400 on a non-positive end_day', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Облога', color: '#ff0000', end_day: 0 } });
    const res = mockRes();

    await ChronologyEventController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyEventModel.create).not.toHaveBeenCalled();
  });

  it('returns 400 when both location_id and region are set', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({
      params: { id: 'c1' },
      body: { name: 'Битва', color: '#ff0000', location_id: 'loc-1', region: 'Північні землі' },
    });
    const res = mockRes();

    await ChronologyEventController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyEventModel.create).not.toHaveBeenCalled();
  });

  it('skips the month check when month_id is not provided (unpinned event)', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyEventModel.create.mockResolvedValue({ id: 'e1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Легенда', color: '#ff0000' } });
    const res = mockRes();

    await ChronologyEventController.create(req, res);

    expect(ChronologyEventModel.monthBelongsToCalendar).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('creates a global event scoped to the calendar once validation passes', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyEventModel.monthBelongsToCalendar.mockResolvedValue(true);
    ChronologyEventModel.create.mockResolvedValue({ id: 'e1' });
    const body = { name: 'Заснування міста', color: '#4caf50', month_id: 'm1', year: 100, day: 1 };
    const req = mockReq({ params: { id: 'c1' }, body });
    const res = mockRes();

    await ChronologyEventController.create(req, res);

    expect(ChronologyEventModel.create).toHaveBeenCalledWith('c1', body);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('ChronologyEventController.update', () => {
  it('returns 404 when the event does not exist for this calendar', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyEventModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', eventId: 'e1' }, body: { name: 'x', color: '#000000' } });
    const res = mockRes();

    await ChronologyEventController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('ChronologyEventController.remove', () => {
  it('returns 404 when nothing was deleted', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyEventModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', eventId: 'e1' } });
    const res = mockRes();

    await ChronologyEventController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deletes the event scoped to the calendar', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyEventModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', eventId: 'e1' } });
    const res = mockRes();

    await ChronologyEventController.remove(req, res);

    expect(ChronologyEventModel.delete).toHaveBeenCalledWith('e1', 'c1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});

describe('ChronologyEventController.listByParticipant', () => {
  it('passes the viewer\'s visibility flags through', async () => {
    ChronologyEventModel.findAllByParticipant.mockResolvedValue([{ id: 'e1' }]);
    const res = mockRes();
    await ChronologyEventController.listByParticipant(mockReq({ params: { entryId: 'n1' }, user: { sub: 'u1', role: 'user' } }), res);
    expect(ChronologyEventModel.findAllByParticipant).toHaveBeenCalledWith('n1', { userId: 'u1', isAdmin: false, isManager: false });
    expect(res.json).toHaveBeenCalledWith({ events: [{ id: 'e1' }] });
  });

  it('managers see private/campaign events, admins any calendar', async () => {
    ChronologyEventModel.findAllByParticipant.mockResolvedValue([]);
    await ChronologyEventController.listByParticipant(mockReq({ params: { entryId: 'n1' }, user: { sub: 'a1', role: 'admin' } }), mockRes());
    expect(ChronologyEventModel.findAllByParticipant).toHaveBeenCalledWith('n1', { userId: 'a1', isAdmin: true, isManager: true });
  });
});

describe('ChronologyEventController participants', () => {
  beforeEach(() => ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' }));

  it('400 without entry_id', async () => {
    const res = mockRes();
    await ChronologyEventController.addParticipant(mockReq({ params: { id: 'c1', eventId: 'e1' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('404 when the event is not in this calendar', async () => {
    ChronologyEventModel.findById.mockResolvedValue(null);
    const res = mockRes();
    await ChronologyEventController.addParticipant(mockReq({ params: { id: 'c1', eventId: 'e9' }, body: { entry_id: 'n1' } }), res);
    expect(ChronologyEventModel.findById).toHaveBeenCalledWith('e9', 'c1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(ChronologyEventModel.addParticipant).not.toHaveBeenCalled();
  });

  it('201 adds one participant', async () => {
    ChronologyEventModel.findById.mockResolvedValue({ id: 'e1' });
    const res = mockRes();
    await ChronologyEventController.addParticipant(mockReq({ params: { id: 'c1', eventId: 'e1' }, body: { entry_id: 'n1' } }), res);
    expect(ChronologyEventModel.addParticipant).toHaveBeenCalledWith('e1', 'n1');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('404 when removing someone who was not a participant', async () => {
    ChronologyEventModel.findById.mockResolvedValue({ id: 'e1' });
    ChronologyEventModel.removeParticipant.mockResolvedValue(false);
    const res = mockRes();
    await ChronologyEventController.removeParticipant(mockReq({ params: { id: 'c1', eventId: 'e1', entryId: 'n1' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
