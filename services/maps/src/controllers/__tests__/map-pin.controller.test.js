jest.mock('../../models/map-pin.model');
jest.mock('../../models/location.model');
jest.mock('../../models/map.model');
jest.mock('../../models/map-lens.model');
jest.mock('../../models/campaign-membership.model');

const MapPinModel = require('../../models/map-pin.model');
const LocationModel = require('../../models/location.model');
const MapModel = require('../../models/map.model');
const MapLensModel = require('../../models/map-lens.model');
const CampaignMembershipModel = require('../../models/campaign-membership.model');
const MapPinController = require('../map-pin.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, query = {}, user = { sub: 'gm-1', role: 'game_master' } } = {}) {
  return { body, params, query, user };
}

const ownMap = { id: 'm1', created_by: 'gm-1', is_public: true };
const PLAYER = { sub: 'p-1', role: 'user' };

beforeEach(() => {
  jest.clearAllMocks();
  MapModel.findById.mockResolvedValue(ownMap);
  LocationModel.findById.mockResolvedValue({ id: 'loc1', created_by: 'gm-1' });
  MapLensModel.listByMap.mockResolvedValue([{ id: 'lens-1' }, { id: 'lens-2' }]);
});

describe('MapPinController.list', () => {
  it('gives the map owner every pin, unfiltered', async () => {
    MapPinModel.listByMap.mockResolvedValue([{ id: 'p1', visible_campaign_ids: ['camp-1'] }]);
    const res = mockRes();
    await MapPinController.list(mockReq({ params: { mapId: 'm1' } }), res);
    expect(MapPinModel.listByMap).toHaveBeenCalledWith('m1');
    expect(MapPinModel.listVisibleToPlayer).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ pins: [{ id: 'p1', visible_campaign_ids: ['camp-1'] }] });
  });

  it('filters for a non-owner without a campaign_id (unrestricted pins only)', async () => {
    MapPinModel.listVisibleToPlayer.mockResolvedValue([{ id: 'p1' }]);
    const res = mockRes();
    await MapPinController.list(mockReq({ params: { mapId: 'm1' }, user: PLAYER }), res);
    expect(MapPinModel.listVisibleToPlayer).toHaveBeenCalledWith('m1', null);
    expect(CampaignMembershipModel.isMember).not.toHaveBeenCalled();
  });

  it('trusts ?campaign_id only once membership is verified', async () => {
    CampaignMembershipModel.isMember.mockResolvedValue(true);
    MapPinModel.listVisibleToPlayer.mockResolvedValue([]);
    const res = mockRes();
    await MapPinController.list(mockReq({ params: { mapId: 'm1' }, query: { campaign_id: 'camp-1' }, user: PLAYER }), res);
    expect(CampaignMembershipModel.isMember).toHaveBeenCalledWith('camp-1', 'p-1');
    expect(MapPinModel.listVisibleToPlayer).toHaveBeenCalledWith('m1', 'camp-1');
  });

  it('ignores ?campaign_id when the requester is not actually a member of it', async () => {
    CampaignMembershipModel.isMember.mockResolvedValue(false);
    MapPinModel.listVisibleToPlayer.mockResolvedValue([]);
    const res = mockRes();
    await MapPinController.list(mockReq({ params: { mapId: 'm1' }, query: { campaign_id: 'camp-1' }, user: PLAYER }), res);
    expect(MapPinModel.listVisibleToPlayer).toHaveBeenCalledWith('m1', null);
  });
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

  it.each([
    ['lens_ids', { lens_ids: ['not-a-uuid'] }],
    ['lens_ids (not an array)', { lens_ids: 'lens-1' }],
    ['visible_campaign_ids', { visible_campaign_ids: ['not-a-uuid'] }],
  ])('400 for malformed %s', async (_n, extra) => {
    const res = mockRes();
    await MapPinController.add(mockReq({ params: { mapId: 'm1' }, body: { ...okBody, ...extra } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(MapPinModel.add).not.toHaveBeenCalled();
  });

  it('400 when a lens_id does not belong to this map', async () => {
    MapLensModel.listByMap.mockResolvedValue([{ id: 'lens-1' }]);
    const res = mockRes();
    await MapPinController.add(mockReq({
      params: { mapId: 'm1' }, body: { ...okBody, lens_ids: ['22222222-2222-4222-8222-222222222222'] },
    }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(MapPinModel.add).not.toHaveBeenCalled();
  });

  it('201 with default zoom and empty id arrays applied', async () => {
    MapPinModel.add.mockResolvedValue({ id: 'p1' });
    const res = mockRes();
    await MapPinController.add(mockReq({ params: { mapId: 'm1' }, body: okBody }), res);
    expect(MapPinModel.add).toHaveBeenCalledWith('m1', {
      locationId: 'loc1', x: 0.5, y: 0.5, minZoom: 0, maxZoom: 100, lensIds: [], visibleCampaignIds: [],
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('201 with lens_ids/visible_campaign_ids passed through once validated', async () => {
    MapPinModel.add.mockResolvedValue({ id: 'p1' });
    const res = mockRes();
    const body = { ...okBody, lens_ids: ['lens-1'], visible_campaign_ids: ['22222222-2222-4222-8222-222222222222'] };
    await MapPinController.add(mockReq({ params: { mapId: 'm1' }, body }), res);
    expect(MapPinModel.add).toHaveBeenCalledWith('m1', {
      locationId: 'loc1', x: 0.5, y: 0.5, minZoom: 0, maxZoom: 100,
      lensIds: ['lens-1'], visibleCampaignIds: ['22222222-2222-4222-8222-222222222222'],
    });
  });
});

describe('MapPinController.update / remove', () => {
  it('update 404 when pin not on this map', async () => {
    MapPinModel.update.mockResolvedValue(null);
    const res = mockRes();
    await MapPinController.update(mockReq({ params: { mapId: 'm1', pinId: 'x' }, body: { x_coordinate: 0.2, y_coordinate: 0.3 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('update passes default empty id arrays through when omitted', async () => {
    MapPinModel.update.mockResolvedValue({ id: 'p1' });
    const res = mockRes();
    await MapPinController.update(mockReq({ params: { mapId: 'm1', pinId: 'p1' }, body: { x_coordinate: 0.2, y_coordinate: 0.3 } }), res);
    expect(MapPinModel.update).toHaveBeenCalledWith('p1', 'm1', {
      x: 0.2, y: 0.3, minZoom: 0, maxZoom: 100, lensIds: [], visibleCampaignIds: [],
    });
  });

  it('remove 204 for the owner', async () => {
    MapPinModel.remove.mockResolvedValue(true);
    const res = mockRes();
    await MapPinController.remove(mockReq({ params: { mapId: 'm1', pinId: 'p1' } }), res);
    expect(MapPinModel.remove).toHaveBeenCalledWith('p1', 'm1');
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
