jest.mock('../../models/location.model');

const LocationModel = require('../../models/location.model');
const LocationController = require('../location.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, user = { sub: 'gm-1', role: 'game_master' } } = {}) {
  return { body, params, user };
}

const OWNER = { sub: 'gm-1', role: 'game_master' };
const PLAYER = { sub: 'p-1', role: 'user' };
const fullLocation = { id: 'loc1', created_by: 'gm-1', name: 'Rivertown', gm_note: 'secret plot' };

beforeEach(() => jest.clearAllMocks());

describe('LocationController.create', () => {
  it('403 for a non-GM/non-admin', async () => {
    const res = mockRes();
    await LocationController.create(mockReq({ body: { name: 'X' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(LocationModel.create).not.toHaveBeenCalled();
  });

  it('accepts an arbitrary config-defined type', async () => {
    LocationModel.create.mockResolvedValue({ id: 'loc9', created_by: 'gm-1', type: 'capital' });
    const res = mockRes();
    await LocationController.create(mockReq({ body: { name: 'X', type: 'capital' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(LocationModel.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'capital' }));
  });

  it('400 for an over-long type', async () => {
    const res = mockRes();
    await LocationController.create(mockReq({ body: { name: 'X', type: 'a'.repeat(51) }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('201 for a GM, mapping body -> model fields', async () => {
    LocationModel.create.mockResolvedValue(fullLocation);
    const res = mockRes();
    await LocationController.create(mockReq({ body: { name: '  Rivertown  ', gm_note: 'secret plot', type: 'city' }, user: OWNER }), res);
    expect(LocationModel.create).toHaveBeenCalledWith({
      createdBy: 'gm-1', name: 'Rivertown', description: null,
      gmNote: 'secret plot', imageUrls: [], type: 'city',
      markerIcon: null, markerLevel: null,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('accepts a gallery of images and 400s on an invalid one', async () => {
    LocationModel.create.mockResolvedValue(fullLocation);
    const okRes = mockRes();
    await LocationController.create(mockReq({ body: { name: 'X', image_urls: ['/uploads/a.jpg', 'https://x/y.png'] }, user: OWNER }), okRes);
    expect(LocationModel.create).toHaveBeenCalledWith(expect.objectContaining({ imageUrls: ['/uploads/a.jpg', 'https://x/y.png'] }));
    expect(okRes.status).toHaveBeenCalledWith(201);

    LocationModel.create.mockClear();
    const badRes = mockRes();
    await LocationController.create(mockReq({ body: { name: 'X', image_urls: ['/uploads/a.jpg', 'javascript:alert(1)'] }, user: OWNER }), badRes);
    expect(badRes.status).toHaveBeenCalledWith(400);
    expect(LocationModel.create).not.toHaveBeenCalled();
  });

  it('maps an uploaded marker icon + level into model fields', async () => {
    LocationModel.create.mockResolvedValue(fullLocation);
    const res = mockRes();
    await LocationController.create(mockReq({
      body: { name: 'X', marker_icon: '/uploads/maps/marker-icons/a.png', marker_level: 2 }, user: OWNER,
    }), res);
    expect(LocationModel.create).toHaveBeenCalledWith(expect.objectContaining({
      markerIcon: '/uploads/maps/marker-icons/a.png', markerLevel: 2,
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('accepts an emoji as the marker icon', async () => {
    LocationModel.create.mockResolvedValue(fullLocation);
    const res = mockRes();
    await LocationController.create(mockReq({ body: { name: 'X', marker_icon: '🏰' }, user: OWNER }), res);
    expect(LocationModel.create).toHaveBeenCalledWith(expect.objectContaining({ markerIcon: '🏰' }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('400 for a marker icon that is neither a URL nor a short glyph', async () => {
    const res = mockRes();
    await LocationController.create(mockReq({ body: { name: 'X', marker_icon: 'foo/bar/baz' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(LocationModel.create).not.toHaveBeenCalled();
  });

  it('400 for a marker level outside 1..4', async () => {
    const res = mockRes();
    await LocationController.create(mockReq({ body: { name: 'X', marker_level: 5 }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(LocationModel.create).not.toHaveBeenCalled();
  });
});

describe('LocationController.getOne — gm_note visibility', () => {
  beforeEach(() => LocationModel.findById.mockResolvedValue(fullLocation));

  it('404 when missing', async () => {
    LocationModel.findById.mockResolvedValue(null);
    const res = mockRes();
    await LocationController.getOne(mockReq({ params: { id: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('owner sees gm_note without a readable-map check', async () => {
    const res = mockRes();
    await LocationController.getOne(mockReq({ params: { id: 'loc1' }, user: OWNER }), res);
    expect(LocationModel.isPinnedOnReadableMap).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ location: fullLocation });
  });

  it('player on a readable map gets it WITHOUT gm_note', async () => {
    LocationModel.isPinnedOnReadableMap.mockResolvedValue(true);
    const res = mockRes();
    await LocationController.getOne(mockReq({ params: { id: 'loc1' }, user: PLAYER }), res);
    const payload = res.json.mock.calls[0][0].location;
    expect(payload).not.toHaveProperty('gm_note');
    expect(payload.name).toBe('Rivertown');
  });

  it('403 when the location is on no map the user can read', async () => {
    LocationModel.isPinnedOnReadableMap.mockResolvedValue(false);
    const res = mockRes();
    await LocationController.getOne(mockReq({ params: { id: 'loc1' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('LocationController.update / remove', () => {
  beforeEach(() => LocationModel.findById.mockResolvedValue(fullLocation));

  it('update 403 for a non-owner', async () => {
    const res = mockRes();
    await LocationController.update(mockReq({ params: { id: 'loc1' }, body: { name: 'X' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('update 200 for the owner', async () => {
    LocationModel.update.mockResolvedValue({ ...fullLocation, name: 'Renamed' });
    const res = mockRes();
    await LocationController.update(mockReq({ params: { id: 'loc1' }, body: { name: 'Renamed' }, user: OWNER }), res);
    expect(res.json).toHaveBeenCalledWith({ location: { ...fullLocation, name: 'Renamed' } });
  });

  it('remove 204 for the owner', async () => {
    LocationModel.remove.mockResolvedValue(true);
    const res = mockRes();
    await LocationController.remove(mockReq({ params: { id: 'loc1' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
