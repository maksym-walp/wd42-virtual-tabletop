jest.mock('../../models/map-pin.model');
jest.mock('../../models/location.model');
jest.mock('../../models/map.model');

const MapPinModel = require('../../models/map-pin.model');
const LocationModel = require('../../models/location.model');
const MapModel = require('../../models/map.model');
const MapPinController = require('../map-pin.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, user = { sub: 'gm-1', role: 'game_master' } } = {}) {
  return { body, params, user };
}

const ownMap = { id: 'm1', created_by: 'gm-1', is_public: true };
const PLAYER = { sub: 'p-1', role: 'user' };

beforeEach(() => {
  jest.clearAllMocks();
  MapModel.findById.mockResolvedValue(ownMap);
  LocationModel.findById.mockResolvedValue({ id: 'loc1', created_by: 'gm-1' });
});

describe('MapPinController.add', () => {
  const okBody = { location_id: 'loc1', x_coordinate: 0.5, y_coordinate: 0.5 };

  it('403 for a non-owner (even on a public map)', async () => {
    const res = mockRes();
    await MapPinController.add(mockReq({ params: { mapId: 'm1' }, body: okBody, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(MapPinModel.add).not.toHaveBeenCalled();
  });

  it.each([
    ['x out of range', { x_coordinate: 1.5, y_coordinate: 0.5 }],
    ['non-numeric y', { x_coordinate: 0.5, y_coordinate: '0.5' }],
  ])('400 for %s', async (_n, coords) => {
    const res = mockRes();
    await MapPinController.add(mockReq({ params: { mapId: 'm1' }, body: { location_id: 'loc1', ...coords } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 when min_zoom > max_zoom', async () => {
    const res = mockRes();
    await MapPinController.add(mockReq({ params: { mapId: 'm1' }, body: { ...okBody, min_zoom: 8, max_zoom: 3 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 when pinning a location the user does not own', async () => {
    LocationModel.findById.mockResolvedValue({ id: 'loc1', created_by: 'someone-else' });
    const res = mockRes();
    await MapPinController.add(mockReq({ params: { mapId: 'm1' }, body: okBody }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(MapPinModel.add).not.toHaveBeenCalled();
  });

  it('201 with default zoom applied', async () => {
    MapPinModel.add.mockResolvedValue({ id: 'p1' });
    const res = mockRes();
    await MapPinController.add(mockReq({ params: { mapId: 'm1' }, body: okBody }), res);
    expect(MapPinModel.add).toHaveBeenCalledWith('m1', { locationId: 'loc1', x: 0.5, y: 0.5, minZoom: 0, maxZoom: 100 });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('MapPinController.update / remove', () => {
  it('update 404 when pin not on this map', async () => {
    MapPinModel.update.mockResolvedValue(null);
    const res = mockRes();
    await MapPinController.update(mockReq({ params: { mapId: 'm1', pinId: 'x' }, body: { x_coordinate: 0.2, y_coordinate: 0.3 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('remove 204 for the owner', async () => {
    MapPinModel.remove.mockResolvedValue(true);
    const res = mockRes();
    await MapPinController.remove(mockReq({ params: { mapId: 'm1', pinId: 'p1' } }), res);
    expect(MapPinModel.remove).toHaveBeenCalledWith('p1', 'm1');
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
