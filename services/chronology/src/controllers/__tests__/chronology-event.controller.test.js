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

  it.each([
    [{ recurrence: 'interval_days' }],
    [{ recurrence: 'interval_days', recurrence_interval: 0 }],
    [{ recurrence: 'lunar', recurrence_interval: 1, moon_phase: 50 }],
    [{ recurrence: 'lunar', recurrence_interval: 1, moon_id: 'mo1', moon_phase: 100 }],
    [{ recurrence: 'lunar', recurrence_interval: 1, moon_id: 'mo1' }],
  ])('returns 400 on invalid interval/lunar fields %j', async (extra) => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Обряд', color: '#ff0000', ...extra } });
    const res = mockRes();

    await ChronologyEventController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyEventModel.create).not.toHaveBeenCalled();
  });

  it('returns 400 when the moon does not belong to this calendar', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyEventModel.moonBelongsToCalendar.mockResolvedValue(false);
    const req = mockReq({
      params: { id: 'c1' },
      body: { name: 'Обряд', color: '#ff0000', recurrence: 'lunar', recurrence_interval: 1, moon_id: 'other', moon_phase: 50 },
    });
    const res = mockRes();

    await ChronologyEventController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyEventModel.create).not.toHaveBeenCalled();
  });

  it('accepts a valid lunar recurrence', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyEventModel.moonBelongsToCalendar.mockResolvedValue(true);
    ChronologyEventModel.create.mockResolvedValue({ id: 'e1' });
    const req = mockReq({
      params: { id: 'c1' },
      body: { name: 'Обряд', color: '#ff0000', recurrence: 'lunar', recurrence_interval: 2, moon_id: 'mo1', moon_phase: 50 },
    });
    const res = mockRes();

    await ChronologyEventController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
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

  it('returns 400 on an unknown duration_display', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Облога', color: '#ff0000', duration_display: 'sometimes' } });
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

describe('ChronologyEventController event types', () => {
  it('400s on a type that is not configured', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyEventModel.getEventTypes.mockResolvedValue([{ key: 'battle', label: 'Битва', color: '#d9534f' }]);
    const res = mockRes();
    await ChronologyEventController.create(mockReq({
      params: { id: 'c1' }, body: { name: 'x', color: '#000000', event_type: 'nope' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyEventModel.create).not.toHaveBeenCalled();
  });

  it('accepts a configured type and an empty one', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologyEventModel.getEventTypes.mockResolvedValue([{ key: 'battle', label: 'Битва', color: '#d9534f' }]);
    ChronologyEventModel.create.mockResolvedValue({ id: 'e1' });
    for (const event_type of ['battle', '', null]) {
      const res = mockRes();
      await ChronologyEventController.create(mockReq({
        params: { id: 'c1' }, body: { name: 'x', color: '#000000', event_type },
      }), res);
      expect(res.status).toHaveBeenCalledWith(201);
    }
  });

  it('listTypes returns the configured types', async () => {
    ChronologyEventModel.getEventTypes.mockResolvedValue([{ key: 'battle' }]);
    const res = mockRes();
    await ChronologyEventController.listTypes(mockReq(), res);
    expect(res.json).toHaveBeenCalledWith({ event_types: [{ key: 'battle' }] });
  });
});

describe('ChronologyEventController.getOne', () => {
  const event = { id: 'e1', calendar_id: 'c1', is_public: true, campaign_id: null };
  const params = { id: 'c1', eventId: 'e1' };
  const player = { sub: 'u1', role: 'user' };

  it('404s when the calendar is not visible or the event is not in it', async () => {
    ChronologyModel.findById.mockResolvedValue(null);
    const res = mockRes();
    await ChronologyEventController.getOne(mockReq({ params }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(ChronologyEventModel.findDetailed).not.toHaveBeenCalled();

    ChronologyModel.findById.mockResolvedValue({ id: 'c1' });
    ChronologyEventModel.findDetailed.mockResolvedValue(null);
    const res2 = mockRes();
    await ChronologyEventController.getOne(mockReq({ params }), res2);
    expect(res2.status).toHaveBeenCalledWith(404);
    expect(ChronologyEventModel.findDetailed).toHaveBeenCalledWith('e1', 'c1');
  });

  it('hides private and campaign events from regular users, unless opened from that campaign', async () => {
    ChronologyModel.findById.mockResolvedValue({ id: 'c1' });

    ChronologyEventModel.findDetailed.mockResolvedValue({ ...event, is_public: false });
    const res = mockRes();
    await ChronologyEventController.getOne(mockReq({ params, user: player }), res);
    expect(res.status).toHaveBeenCalledWith(404);

    ChronologyEventModel.findDetailed.mockResolvedValue({ ...event, campaign_id: 'camp-1' });
    const res2 = mockRes();
    await ChronologyEventController.getOne(mockReq({ params, user: player }), res2);
    expect(res2.status).toHaveBeenCalledWith(404);

    const res3 = mockRes();
    await ChronologyEventController.getOne(mockReq({ params, query: { campaign_id: 'camp-1' }, user: player }), res3);
    expect(res3.json).toHaveBeenCalled();
  });

  it('shows a public global event to a regular user, and any event to a manager', async () => {
    ChronologyModel.findById.mockResolvedValue({ id: 'c1' });
    ChronologyEventModel.findDetailed.mockResolvedValue(event);
    const res = mockRes();
    await ChronologyEventController.getOne(mockReq({ params, user: player }), res);
    expect(res.json).toHaveBeenCalledWith({ event });

    ChronologyEventModel.findDetailed.mockResolvedValue({ ...event, is_public: false, campaign_id: 'camp-1' });
    const res2 = mockRes();
    await ChronologyEventController.getOne(mockReq({ params }), res2);
    expect(res2.json).toHaveBeenCalledWith({ event: expect.objectContaining({ id: 'e1' }) });
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

describe('ChronologyEventController list scope and calendar move', () => {
  it('only requests synced events for a synced calendar', async () => {
    ChronologyModel.findById.mockResolvedValue({ id: 'c1', is_default: false, sync_offset_days: 4 });
    ChronologyEventModel.findAllByCalendar.mockResolvedValue([]);
    await ChronologyEventController.list(mockReq({ params: { id: 'c1' }, query: { scope: 'synced' } }), mockRes());
    expect(ChronologyEventModel.findAllByCalendar.mock.calls[0][1].synced).toEqual({ userId: 'user-1', isAdmin: false });

    ChronologyModel.findById.mockResolvedValue({ id: 'c1', is_default: false, sync_offset_days: null });
    await ChronologyEventController.list(mockReq({ params: { id: 'c1' }, query: { scope: 'synced' } }), mockRes());
    expect(ChronologyEventModel.findAllByCalendar.mock.calls[1][1].synced).toBeUndefined();

    ChronologyModel.findById.mockResolvedValue({ id: 'c1', is_default: true, sync_offset_days: 0 });
    await ChronologyEventController.list(mockReq({ params: { id: 'c1' } }), mockRes());
    expect(ChronologyEventModel.findAllByCalendar.mock.calls[2][1].synced).toBeUndefined(); // scope not requested
  });

  it('moves an event to another calendar, validating months against the target', async () => {
    ChronologyModel.findByIdRaw.mockImplementation(async (id) => ({ id }));
    ChronologyEventModel.monthBelongsToCalendar.mockResolvedValue(true);
    ChronologyEventModel.update.mockResolvedValue({ id: 'e1' });
    const req = mockReq({
      params: { id: 'c1', eventId: 'e1' },
      body: { name: 'Свято', color: '#ff0000', calendar_id: 'c2', month_id: 'm9' },
    });
    await ChronologyEventController.update(req, mockRes());
    expect(ChronologyEventModel.monthBelongsToCalendar).toHaveBeenCalledWith('m9', 'c2');
    expect(ChronologyEventModel.update).toHaveBeenCalledWith('e1', 'c1', req.body, 'c2');
  });

  it('400s when the target calendar does not exist', async () => {
    ChronologyModel.findByIdRaw.mockImplementation(async (id) => (id === 'c1' ? { id } : null));
    const res = mockRes();
    await ChronologyEventController.update(mockReq({
      params: { id: 'c1', eventId: 'e1' }, body: { name: 'x', color: '#ff0000', calendar_id: 'ghost' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologyEventModel.update).not.toHaveBeenCalled();
  });
});
