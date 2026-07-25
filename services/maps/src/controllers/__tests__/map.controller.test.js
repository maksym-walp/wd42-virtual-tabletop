jest.mock('../../models/map.model');

const MapModel = require('../../models/map.model');
const MapController = require('../map.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, user = { sub: 'u1', role: 'user' } } = {}) {
  return { body, params, user };
}

const GM = { sub: 'gm-1', role: 'game_master' };
const PLAYER = { sub: 'p-1', role: 'user' };
const ADMIN = { sub: 'a-1', role: 'admin' };
const ownPrivate = { id: 'm1', created_by: 'gm-1', is_public: false };
const publicMap = { id: 'm2', created_by: 'gm-1', is_public: true };

beforeEach(() => jest.clearAllMocks());

describe('MapController.list', () => {
  it('returns the visible maps', async () => {
    MapModel.listVisible.mockResolvedValue([{ id: 'm1' }]);
    const res = mockRes();
    await MapController.list(mockReq({ user: PLAYER }), res);
    expect(MapModel.listVisible).toHaveBeenCalledWith('p-1', false);
    expect(res.json).toHaveBeenCalledWith({ maps: [{ id: 'm1' }] });
  });
});

describe('MapController.create', () => {
  it('403 for a non-GM/non-admin', async () => {
    const res = mockRes();
    await MapController.create(mockReq({ body: { name: 'X' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(MapModel.create).not.toHaveBeenCalled();
  });

  it('400 without a name', async () => {
    const res = mockRes();
    await MapController.create(mockReq({ body: {}, user: GM }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('201 for a GM, passing is_public and stamping is_owner', async () => {
    MapModel.create.mockResolvedValue(ownPrivate);
    const res = mockRes();
    await MapController.create(mockReq({ body: { name: '  Realm  ', is_public: true }, user: GM }), res);
    expect(MapModel.create).toHaveBeenCalledWith('gm-1', 'Realm', true);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ map: { ...ownPrivate, is_owner: true } });
  });

  it('201 for an admin too', async () => {
    MapModel.create.mockResolvedValue({ id: 'm9', created_by: 'a-1', is_public: false });
    const res = mockRes();
    await MapController.create(mockReq({ body: { name: 'X' }, user: ADMIN }), res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('MapController.getOne', () => {
  it('404 when missing', async () => {
    MapModel.findById.mockResolvedValue(null);
    const res = mockRes();
    await MapController.getOne(mockReq({ params: { id: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('403 when a player opens a private map they do not own', async () => {
    MapModel.findById.mockResolvedValue(ownPrivate);
    const res = mockRes();
    await MapController.getOne(mockReq({ params: { id: 'm1' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('200 for anyone on a public map, is_owner false', async () => {
    MapModel.findById.mockResolvedValue(publicMap);
    const res = mockRes();
    await MapController.getOne(mockReq({ params: { id: 'm2' }, user: PLAYER }), res);
    expect(res.json).toHaveBeenCalledWith({ map: { ...publicMap, is_owner: false } });
  });
});

describe('MapController.update / remove', () => {
  beforeEach(() => MapModel.findById.mockResolvedValue(ownPrivate));

  it('update 403 for a non-owner', async () => {
    const res = mockRes();
    await MapController.update(mockReq({ params: { id: 'm1' }, body: { name: 'X' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('update 200 for the owner, toggling is_public', async () => {
    MapModel.update.mockResolvedValue({ ...ownPrivate, name: 'New', is_public: true });
    const res = mockRes();
    await MapController.update(mockReq({ params: { id: 'm1' }, body: { name: 'New', is_public: true }, user: GM }), res);
    expect(MapModel.update).toHaveBeenCalledWith('m1', 'New', true);
    expect(res.json).toHaveBeenCalledWith({ map: expect.objectContaining({ is_owner: true, is_public: true }) });
  });

  it('remove 204 for the owner', async () => {
    MapModel.remove.mockResolvedValue(true);
    const res = mockRes();
    await MapController.remove(mockReq({ params: { id: 'm1' }, user: GM }), res);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('remove 403 for a non-owner (even on a public map)', async () => {
    MapModel.findById.mockResolvedValue(publicMap);
    const res = mockRes();
    await MapController.remove(mockReq({ params: { id: 'm2' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(MapModel.remove).not.toHaveBeenCalled();
  });
});
