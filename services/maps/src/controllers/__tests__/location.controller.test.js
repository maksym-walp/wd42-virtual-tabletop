jest.mock('../../models/location.model');
jest.mock('../../models/location-version.model');

const LocationModel = require('../../models/location.model');
const LocationVersionModel = require('../../models/location-version.model');
const LocationController = require('../location.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, user = { sub: 'gm-1', role: 'game_master' } } = {}) {
  return { body, params, user };
}

const OWNER = { sub: 'gm-1', role: 'game_master' };
const PLAYER = { sub: 'p-1', role: 'user' };
const baseLocation = { id: 'loc1', created_by: 'gm-1', name: 'Rivertown', type: 'city' };

beforeEach(() => {
  jest.clearAllMocks();
  LocationModel.create.mockResolvedValue(baseLocation);
  LocationVersionModel.add.mockResolvedValue({ id: 'v1', start_year: null, description: null, gm_note: null, image_url: null });
});

describe('LocationController.create', () => {
  it('403 for a non-GM/non-admin', async () => {
    const res = mockRes();
    await LocationController.create(mockReq({ body: { name: 'X' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(LocationModel.create).not.toHaveBeenCalled();
  });

  it('accepts an arbitrary set of free-form types', async () => {
    const res = mockRes();
    await LocationController.create(mockReq({ body: { name: 'X', types: ['capital', 'city'] }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(LocationModel.create).toHaveBeenCalledWith(expect.objectContaining({ types: ['capital', 'city'] }));
  });

  it('400 for an over-long type key', async () => {
    const res = mockRes();
    await LocationController.create(mockReq({ body: { name: 'X', types: ['a'.repeat(51)] }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('201 — splits body into base fields + the first (base) version', async () => {
    const res = mockRes();
    await LocationController.create(mockReq({
      body: { name: '  Rivertown  ', gm_note: 'secret plot', description: 'A town', types: ['city'] }, user: OWNER,
    }), res);
    expect(LocationModel.create).toHaveBeenCalledWith({
      createdBy: 'gm-1', name: 'Rivertown', types: ['city'], markerIcon: null, markerLevel: null,
    });
    expect(LocationVersionModel.add).toHaveBeenCalledWith('loc1', {
      startYear: null, endYear: null, description: 'A town', gmNote: 'secret plot', imageUrl: null,
      name: null, markerIcon: null, markerLevel: null, types: null,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0].location;
    expect(payload.name).toBe('Rivertown');
    expect(payload.versions).toHaveLength(1);
  });

  it('carries a start_year for the first version', async () => {
    const res = mockRes();
    await LocationController.create(mockReq({ body: { name: 'X', start_year: 500, description: 'Capital' }, user: OWNER }), res);
    expect(LocationVersionModel.add).toHaveBeenCalledWith('loc1', expect.objectContaining({ startYear: 500 }));
  });

  it('400 for a malformed start_year', async () => {
    const res = mockRes();
    await LocationController.create(mockReq({ body: { name: 'X', start_year: 12.5 }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(LocationModel.create).not.toHaveBeenCalled();
  });

  it('400 when start_year is after end_year', async () => {
    const res = mockRes();
    await LocationController.create(mockReq({ body: { name: 'X', start_year: 700, end_year: 600 }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(LocationModel.create).not.toHaveBeenCalled();
  });

  it('400 for an invalid version image_url', async () => {
    const res = mockRes();
    await LocationController.create(mockReq({ body: { name: 'X', image_url: 'javascript:alert(1)' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(LocationModel.create).not.toHaveBeenCalled();
  });

  it('maps an uploaded marker icon + level into base fields', async () => {
    const res = mockRes();
    await LocationController.create(mockReq({
      body: { name: 'X', marker_icon: '/uploads/maps/marker-icons/a.png', marker_level: 2 }, user: OWNER,
    }), res);
    expect(LocationModel.create).toHaveBeenCalledWith(expect.objectContaining({
      markerIcon: '/uploads/maps/marker-icons/a.png', markerLevel: 2,
    }));
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
  const withVersions = {
    ...baseLocation,
    versions: [{ id: 'v1', start_year: null, description: 'town', gm_note: 'secret plot', image_url: null }],
  };
  beforeEach(() => LocationModel.findByIdWithVersions.mockResolvedValue(withVersions));

  it('404 when missing', async () => {
    LocationModel.findByIdWithVersions.mockResolvedValue(null);
    const res = mockRes();
    await LocationController.getOne(mockReq({ params: { id: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('owner sees gm_note on every version without a readable-map check', async () => {
    const res = mockRes();
    await LocationController.getOne(mockReq({ params: { id: 'loc1' }, user: OWNER }), res);
    expect(LocationModel.isPinnedOnReadableMap).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].location.versions[0].gm_note).toBe('secret plot');
  });

  it('player on a readable map gets versions WITHOUT gm_note', async () => {
    LocationModel.isPinnedOnReadableMap.mockResolvedValue(true);
    const res = mockRes();
    await LocationController.getOne(mockReq({ params: { id: 'loc1' }, user: PLAYER }), res);
    const payload = res.json.mock.calls[0][0].location;
    expect(payload.versions[0]).not.toHaveProperty('gm_note');
    expect(payload.versions[0].description).toBe('town');
    expect(payload.name).toBe('Rivertown');
  });

  it('403 when the location is on no map the user can read', async () => {
    LocationModel.isPinnedOnReadableMap.mockResolvedValue(false);
    const res = mockRes();
    await LocationController.getOne(mockReq({ params: { id: 'loc1' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('LocationController.export / import', () => {
  it('export strips server-only fields and per-version ids', async () => {
    LocationModel.listByOwner.mockResolvedValue([{
      id: 'loc1', created_by: 'gm-1', created_at: 't', updated_at: 't', name: 'X', type: 'city',
      marker_icon: '🏰', marker_level: 3,
      versions: [{ id: 'v1', start_year: null, description: 'd', gm_note: 'g', image_url: '/uploads/a.jpg', name: null, marker_icon: null, marker_level: null }],
    }]);
    const res = mockRes();
    await LocationController.export(mockReq({ user: OWNER }), res);
    const out = res.json.mock.calls[0][0];
    expect(out[0]).not.toHaveProperty('id');
    expect(out[0]).not.toHaveProperty('created_by');
    expect(out[0].versions[0]).not.toHaveProperty('id');
    expect(out[0].versions[0].gm_note).toBe('g');
    expect(out[0].name).toBe('X');
  });

  it('import 403 for a non-GM', async () => {
    const res = mockRes();
    await LocationController.import(mockReq({ body: [], user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('import 400 when the body is not an array', async () => {
    const res = mockRes();
    await LocationController.import(mockReq({ body: { name: 'X' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('import maps records through the sanitizers and reports the count', async () => {
    LocationModel.bulkImport.mockImplementation(async (userId, records, { toBase, toVersion }) => {
      expect(userId).toBe('gm-1');
      expect(toBase(records[0])).toEqual({ name: 'Town', types: ['city', 'capital'], markerIcon: '🏰', markerLevel: 3 });
      expect(toVersion(records[0].versions[0])).toEqual({
        startYear: 600, endYear: 650, description: 'Ruins', gmNote: null,
        name: 'Руїни', markerIcon: '🏚', markerLevel: 1, types: ['ruin'],
      });
      return 1;
    });
    const res = mockRes();
    await LocationController.import(mockReq({
      body: [{ name: '  Town  ', types: ['city', 'capital'], marker_icon: '🏰', marker_level: 3, versions: [
        { start_year: 600, end_year: 650, description: 'Ruins', name: '  Руїни  ', marker_icon: '🏚', marker_level: 1, types: ['ruin'] },
      ] }],
      user: OWNER,
    }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ imported: 1 });
  });
});

describe('LocationController.update / remove', () => {
  beforeEach(() => LocationModel.findById.mockResolvedValue(baseLocation));

  it('update 403 for a non-owner', async () => {
    const res = mockRes();
    await LocationController.update(mockReq({ params: { id: 'loc1' }, body: { name: 'X' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('update 200 for the owner — base fields only', async () => {
    LocationModel.update.mockResolvedValue({ ...baseLocation, name: 'Renamed' });
    const res = mockRes();
    await LocationController.update(mockReq({ params: { id: 'loc1' }, body: { name: 'Renamed', types: ['ruin'] }, user: OWNER }), res);
    expect(LocationModel.update).toHaveBeenCalledWith('loc1', { name: 'Renamed', types: ['ruin'], markerIcon: null, markerLevel: null });
    expect(res.json).toHaveBeenCalledWith({ location: { ...baseLocation, name: 'Renamed' } });
  });

  it('remove 204 for the owner', async () => {
    LocationModel.remove.mockResolvedValue(true);
    const res = mockRes();
    await LocationController.remove(mockReq({ params: { id: 'loc1' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
