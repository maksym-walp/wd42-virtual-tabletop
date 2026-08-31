jest.mock('../../models/location-version.model');
jest.mock('../../models/location.model');

const LocationVersionModel = require('../../models/location-version.model');
const LocationModel = require('../../models/location.model');
const LocationVersionController = require('../location-version.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, user = { sub: 'gm-1', role: 'game_master' } } = {}) {
  return { body, params, user };
}

const OWNER = { sub: 'gm-1', role: 'game_master' };
const PLAYER = { sub: 'p-1', role: 'user' };
const OK_BODY = { start_year: 600, description: 'Ruins', gm_note: 'sunk', image_url: '/uploads/r.jpg' };

beforeEach(() => {
  jest.clearAllMocks();
  LocationModel.findById.mockResolvedValue({ id: 'loc1', created_by: 'gm-1' });
});

describe('LocationVersionController.add', () => {
  it('404 when the location is missing', async () => {
    LocationModel.findById.mockResolvedValue(null);
    const res = mockRes();
    await LocationVersionController.add(mockReq({ params: { id: 'x' }, body: OK_BODY }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('403 for a non-owner', async () => {
    const res = mockRes();
    await LocationVersionController.add(mockReq({ params: { id: 'loc1' }, body: OK_BODY, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(LocationVersionModel.add).not.toHaveBeenCalled();
  });

  it('400 for a malformed start_year', async () => {
    const res = mockRes();
    await LocationVersionController.add(mockReq({ params: { id: 'loc1' }, body: { start_year: 1.5 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 for a bad image_url', async () => {
    const res = mockRes();
    await LocationVersionController.add(mockReq({ params: { id: 'loc1' }, body: { image_url: 'ftp://x/y' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('201 for the owner', async () => {
    LocationVersionModel.add.mockResolvedValue({ id: 'v2', start_year: 600 });
    const res = mockRes();
    await LocationVersionController.add(mockReq({ params: { id: 'loc1' }, body: OK_BODY }), res);
    expect(LocationVersionModel.add).toHaveBeenCalledWith('loc1', {
      startYear: 600, endYear: null, description: 'Ruins', gmNote: 'sunk', imageUrl: '/uploads/r.jpg',
      name: null, markerIcon: null, markerLevel: null, types: null,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('carries per-version name / marker / types / end_year overrides', async () => {
    LocationVersionModel.add.mockResolvedValue({ id: 'v2' });
    const res = mockRes();
    await LocationVersionController.add(mockReq({ params: { id: 'loc1' }, body: {
      ...OK_BODY, end_year: 650, name: '  Руїни  ', marker_icon: '🏚', marker_level: 1, types: ['ruin', 'dungeon'],
    } }), res);
    expect(LocationVersionModel.add).toHaveBeenCalledWith('loc1', expect.objectContaining({
      endYear: 650, name: 'Руїни', markerIcon: '🏚', markerLevel: 1, types: ['ruin', 'dungeon'],
    }));
  });

  it('400 when start_year is after end_year', async () => {
    const res = mockRes();
    await LocationVersionController.add(mockReq({ params: { id: 'loc1' }, body: { start_year: 700, end_year: 600 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(LocationVersionModel.add).not.toHaveBeenCalled();
  });

  it('400 for a bad per-version marker level', async () => {
    const res = mockRes();
    await LocationVersionController.add(mockReq({ params: { id: 'loc1' }, body: { ...OK_BODY, marker_level: 9 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('409 on a duplicate (location, start_year)', async () => {
    LocationVersionModel.add.mockRejectedValue({ code: '23505' });
    const res = mockRes();
    await LocationVersionController.add(mockReq({ params: { id: 'loc1' }, body: OK_BODY }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('LocationVersionController.update', () => {
  it('404 when the version is not on this location', async () => {
    LocationVersionModel.update.mockResolvedValue(null);
    const res = mockRes();
    await LocationVersionController.update(mockReq({ params: { id: 'loc1', versionId: 'x' }, body: OK_BODY }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('LocationVersionController.remove', () => {
  it('400 when it is the location\'s last version', async () => {
    LocationVersionModel.countByLocation.mockResolvedValue(1);
    const res = mockRes();
    await LocationVersionController.remove(mockReq({ params: { id: 'loc1', versionId: 'v1' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(LocationVersionModel.remove).not.toHaveBeenCalled();
  });

  it('204 when other versions remain', async () => {
    LocationVersionModel.countByLocation.mockResolvedValue(2);
    LocationVersionModel.remove.mockResolvedValue(true);
    const res = mockRes();
    await LocationVersionController.remove(mockReq({ params: { id: 'loc1', versionId: 'v1' } }), res);
    expect(LocationVersionModel.remove).toHaveBeenCalledWith('v1', 'loc1');
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
