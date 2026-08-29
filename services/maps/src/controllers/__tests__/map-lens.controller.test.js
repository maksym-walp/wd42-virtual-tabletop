jest.mock('../../models/map-lens.model');
jest.mock('../../models/map-lens-version.model');
jest.mock('../../models/map.model');

const MapLensModel = require('../../models/map-lens.model');
const MapLensVersionModel = require('../../models/map-lens-version.model');
const MapModel = require('../../models/map.model');
const MapLensController = require('../map-lens.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, user = { sub: 'gm-1', role: 'game_master' } } = {}) {
  return { body, params, user };
}

const ownMap = { id: 'm1', created_by: 'gm-1', is_public: false };
const publicMap = { id: 'm2', created_by: 'gm-1', is_public: true };
const PLAYER = { sub: 'p-1', role: 'user' };

beforeEach(() => {
  jest.clearAllMocks();
  MapModel.findById.mockResolvedValue(ownMap);
});

describe('MapLensController.list', () => {
  it('403 when a player opens a private map', async () => {
    const res = mockRes();
    await MapLensController.list(mockReq({ params: { mapId: 'm1' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('200 for anyone on a public map', async () => {
    MapModel.findById.mockResolvedValue(publicMap);
    MapLensModel.listByMap.mockResolvedValue([{ id: 'l1' }]);
    const res = mockRes();
    await MapLensController.list(mockReq({ params: { mapId: 'm2' }, user: PLAYER }), res);
    expect(res.json).toHaveBeenCalledWith({ lenses: [{ id: 'l1' }] });
  });
});

describe('MapLensController.add', () => {
  it('403 for a non-owner', async () => {
    const res = mockRes();
    await MapLensController.add(mockReq({ params: { mapId: 'm1' }, body: { name: 'P', image_url: 'https://x/y.jpg' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(MapLensModel.add).not.toHaveBeenCalled();
  });

  it('400 for a disallowed image_url', async () => {
    const res = mockRes();
    await MapLensController.add(mockReq({ params: { mapId: 'm1' }, body: { name: 'P', image_url: 'http://insecure/x.jpg' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 for a malformed year', async () => {
    const res = mockRes();
    await MapLensController.add(mockReq({ params: { mapId: 'm1' }, body: { name: 'P', image_url: '/uploads/p.jpg', year: 'soon' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(MapLensModel.add).not.toHaveBeenCalled();
  });

  it('201 for the owner — creates the lens and its first version', async () => {
    MapLensModel.add.mockResolvedValue({ id: 'l1', name: 'Political' });
    MapLensVersionModel.add.mockResolvedValue({ id: 'v1', year: 1200, image_url: '/uploads/p.jpg' });
    const res = mockRes();
    await MapLensController.add(mockReq({ params: { mapId: 'm1' }, body: { name: '  Political  ', image_url: '/uploads/p.jpg', year: 1200 } }), res);
    expect(MapLensModel.add).toHaveBeenCalledWith('m1', 'Political');
    expect(MapLensVersionModel.add).toHaveBeenCalledWith('l1', { year: 1200, imageUrl: '/uploads/p.jpg' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      lens: { id: 'l1', name: 'Political', versions: [{ id: 'v1', year: 1200, image_url: '/uploads/p.jpg' }] },
    });
  });

  it('defaults an omitted year to a timeless (null) version', async () => {
    MapLensModel.add.mockResolvedValue({ id: 'l1', name: 'Political' });
    MapLensVersionModel.add.mockResolvedValue({ id: 'v1', year: null, image_url: '/uploads/p.jpg' });
    const res = mockRes();
    await MapLensController.add(mockReq({ params: { mapId: 'm1' }, body: { name: 'Political', image_url: '/uploads/p.jpg' } }), res);
    expect(MapLensVersionModel.add).toHaveBeenCalledWith('l1', { year: null, imageUrl: '/uploads/p.jpg' });
  });
});

describe('MapLensController.update / remove', () => {
  it('update 404 when the lens is not on this map', async () => {
    MapLensModel.update.mockResolvedValue(null);
    const res = mockRes();
    await MapLensController.update(mockReq({ params: { mapId: 'm1', lensId: 'x' }, body: { name: 'Geo' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('update renames without touching images', async () => {
    MapLensModel.update.mockResolvedValue({ id: 'l1', name: 'Geo' });
    const res = mockRes();
    await MapLensController.update(mockReq({ params: { mapId: 'm1', lensId: 'l1' }, body: { name: '  Geo  ' } }), res);
    expect(MapLensModel.update).toHaveBeenCalledWith('l1', 'm1', { name: 'Geo' });
    expect(res.json).toHaveBeenCalledWith({ lens: { id: 'l1', name: 'Geo' } });
  });

  it('remove 204 for the owner', async () => {
    MapLensModel.remove.mockResolvedValue(true);
    const res = mockRes();
    await MapLensController.remove(mockReq({ params: { mapId: 'm1', lensId: 'l1' } }), res);
    expect(MapLensModel.remove).toHaveBeenCalledWith('l1', 'm1');
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
