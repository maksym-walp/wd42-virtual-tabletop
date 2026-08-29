jest.mock('../../models/map-lens-version.model');
jest.mock('../../models/map.model');
jest.mock('../../models/map-lens.model');

const MapLensVersionModel = require('../../models/map-lens-version.model');
const MapModel = require('../../models/map.model');
const MapLensModel = require('../../models/map-lens.model');
const MapLensVersionController = require('../map-lens-version.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, user = { sub: 'gm-1', role: 'game_master' } } = {}) {
  return { body, params, user };
}

const ownMap = { id: 'm1', created_by: 'gm-1', is_public: true };
const PLAYER = { sub: 'p-1', role: 'user' };
const OK_BODY = { image_url: '/uploads/x.jpg', year: 1200 };

beforeEach(() => {
  jest.clearAllMocks();
  MapModel.findById.mockResolvedValue(ownMap);
  MapLensModel.findById.mockResolvedValue({ id: 'l1', map_id: 'm1' });
});

describe('MapLensVersionController.add', () => {
  it('403 for a non-owner', async () => {
    const res = mockRes();
    await MapLensVersionController.add(mockReq({ params: { mapId: 'm1', lensId: 'l1' }, body: OK_BODY, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(MapLensVersionModel.add).not.toHaveBeenCalled();
  });

  it('404 when the lens is not on this map', async () => {
    MapLensModel.findById.mockResolvedValue(null);
    const res = mockRes();
    await MapLensVersionController.add(mockReq({ params: { mapId: 'm1', lensId: 'other' }, body: OK_BODY }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('400 for a disallowed image_url', async () => {
    const res = mockRes();
    await MapLensVersionController.add(mockReq({ params: { mapId: 'm1', lensId: 'l1' }, body: { image_url: 'http://x/y.jpg' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 for a malformed year', async () => {
    const res = mockRes();
    await MapLensVersionController.add(mockReq({ params: { mapId: 'm1', lensId: 'l1' }, body: { image_url: '/uploads/x.jpg', year: 12.5 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('201 for the owner', async () => {
    MapLensVersionModel.add.mockResolvedValue({ id: 'v1', year: 1200, image_url: '/uploads/x.jpg' });
    const res = mockRes();
    await MapLensVersionController.add(mockReq({ params: { mapId: 'm1', lensId: 'l1' }, body: OK_BODY }), res);
    expect(MapLensVersionModel.add).toHaveBeenCalledWith('l1', { imageUrl: '/uploads/x.jpg', year: 1200 });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('409 on a duplicate (lens, year)', async () => {
    MapLensVersionModel.add.mockRejectedValue({ code: '23505' });
    const res = mockRes();
    await MapLensVersionController.add(mockReq({ params: { mapId: 'm1', lensId: 'l1' }, body: OK_BODY }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('MapLensVersionController.update', () => {
  it('404 when the version is not on this lens', async () => {
    MapLensVersionModel.update.mockResolvedValue(null);
    const res = mockRes();
    await MapLensVersionController.update(mockReq({ params: { mapId: 'm1', lensId: 'l1', versionId: 'x' }, body: OK_BODY }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('MapLensVersionController.remove', () => {
  it('400 when it is the lens\'s last version', async () => {
    MapLensVersionModel.countByLens.mockResolvedValue(1);
    const res = mockRes();
    await MapLensVersionController.remove(mockReq({ params: { mapId: 'm1', lensId: 'l1', versionId: 'v1' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(MapLensVersionModel.remove).not.toHaveBeenCalled();
  });

  it('204 when other versions remain', async () => {
    MapLensVersionModel.countByLens.mockResolvedValue(2);
    MapLensVersionModel.remove.mockResolvedValue(true);
    const res = mockRes();
    await MapLensVersionController.remove(mockReq({ params: { mapId: 'm1', lensId: 'l1', versionId: 'v1' } }), res);
    expect(MapLensVersionModel.remove).toHaveBeenCalledWith('v1', 'l1');
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
