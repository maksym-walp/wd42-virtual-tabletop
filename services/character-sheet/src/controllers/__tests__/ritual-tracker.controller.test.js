jest.mock('../../models/ritual-tracker.model');
jest.mock('../authorize-character-write');

const RitualTrackerModel = require('../../models/ritual-tracker.model');
const authorizeCharacterWrite = require('../authorize-character-write');
const RitualTrackerController = require('../ritual-tracker.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq(overrides = {}) {
  return { params: {}, body: {}, user: { sub: 'user-1' }, ...overrides };
}

beforeEach(() => jest.clearAllMocks());

describe('RitualTrackerController.list', () => {
  it('lists trackers for the character without an auth check', async () => {
    RitualTrackerModel.findAll.mockResolvedValue([{ id: 't1' }]);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await RitualTrackerController.list(req, res);

    expect(RitualTrackerModel.findAll).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ trackers: [{ id: 't1' }] });
  });
});

describe('RitualTrackerController.create', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Ritual' } });
    const res = mockRes();

    await RitualTrackerController.create(req, res);

    expect(RitualTrackerModel.create).not.toHaveBeenCalled();
  });

  it('400s when name is missing', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: {} });
    const res = mockRes();

    await RitualTrackerController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(RitualTrackerModel.create).not.toHaveBeenCalled();
  });

  it('creates and returns 201 on success', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    RitualTrackerModel.create.mockResolvedValue({ id: 't1', name: 'Ritual', rounds: 3, participants: [] });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Ritual', rounds: 3, participants: [] } });
    const res = mockRes();

    await RitualTrackerController.create(req, res);

    expect(RitualTrackerModel.create).toHaveBeenCalledWith('c1', { name: 'Ritual', rounds: 3, participants: [] });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ tracker: { id: 't1', name: 'Ritual', rounds: 3, participants: [] } });
  });
});

describe('RitualTrackerController.update', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', trackerId: 't1' }, body: { name: 'New' } });
    const res = mockRes();

    await RitualTrackerController.update(req, res);

    expect(RitualTrackerModel.update).not.toHaveBeenCalled();
  });

  it('404s when the tracker is not found', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    RitualTrackerModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', trackerId: 't1' }, body: { name: 'New' } });
    const res = mockRes();

    await RitualTrackerController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updates and returns the tracker on success', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    RitualTrackerModel.update.mockResolvedValue({ id: 't1', name: 'New' });
    const req = mockReq({ params: { id: 'c1', trackerId: 't1' }, body: { name: 'New' } });
    const res = mockRes();

    await RitualTrackerController.update(req, res);

    expect(RitualTrackerModel.update).toHaveBeenCalledWith('c1', 't1', { name: 'New' });
    expect(res.json).toHaveBeenCalledWith({ tracker: { id: 't1', name: 'New' } });
  });
});

describe('RitualTrackerController.remove', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', trackerId: 't1' } });
    const res = mockRes();

    await RitualTrackerController.remove(req, res);

    expect(RitualTrackerModel.delete).not.toHaveBeenCalled();
  });

  it('404s when nothing was removed', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    RitualTrackerModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', trackerId: 't1' } });
    const res = mockRes();

    await RitualTrackerController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('confirms removal on success', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    RitualTrackerModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', trackerId: 't1' } });
    const res = mockRes();

    await RitualTrackerController.remove(req, res);

    expect(RitualTrackerModel.delete).toHaveBeenCalledWith('c1', 't1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
