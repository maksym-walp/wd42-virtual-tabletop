jest.mock('../../models/species.model');

const SpeciesModel = require('../../models/species.model');
const SpeciesController = require('../species.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, query = {}, user = OWNER } = {}) {
  return { body, params, query, user };
}

const OWNER = { sub: 'gm-1', role: 'game_master' };
const OTHER_GM = { sub: 'gm-2', role: 'game_master' };
const PLAYER = { sub: 'p-1', role: 'user' };
const ADMIN = { sub: 'a-1', role: 'admin' };
const species = { id: 's1', created_by: 'gm-1', name: 'Elf', is_public: false };

beforeEach(() => jest.clearAllMocks());

describe('SpeciesController.create', () => {
  it('403 for a non-GM/non-admin', async () => {
    const res = mockRes();
    await SpeciesController.create(mockReq({ body: { name: 'Elf' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(SpeciesModel.create).not.toHaveBeenCalled();
  });

  it('400 when name missing', async () => {
    const res = mockRes();
    await SpeciesController.create(mockReq({ body: {}, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('201 for a GM, mapping body -> model fields', async () => {
    SpeciesModel.create.mockResolvedValue(species);
    const res = mockRes();
    await SpeciesController.create(mockReq({ body: { name: ' Elf ', is_public: true, health_die: 'd10' }, user: OWNER }), res);
    expect(SpeciesModel.create).toHaveBeenCalledWith({
      createdBy: 'gm-1', name: 'Elf', description: null, isPublic: true, healthDie: 'd10',
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('defaults health_die to d6 when omitted', async () => {
    SpeciesModel.create.mockResolvedValue(species);
    const res = mockRes();
    await SpeciesController.create(mockReq({ body: { name: 'Elf' }, user: OWNER }), res);
    expect(SpeciesModel.create).toHaveBeenCalledWith(expect.objectContaining({ healthDie: 'd6' }));
  });

  it('400 for an invalid health_die', async () => {
    const res = mockRes();
    await SpeciesController.create(mockReq({ body: { name: 'Elf', health_die: 'd100' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(SpeciesModel.create).not.toHaveBeenCalled();
  });
});

describe('SpeciesController.getOne', () => {
  it('404 when missing', async () => {
    SpeciesModel.findById.mockResolvedValue(null);
    const res = mockRes();
    await SpeciesController.getOne(mockReq({ params: { id: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('403 for a non-owner, non-admin on a private record', async () => {
    SpeciesModel.findById.mockResolvedValue(species);
    const res = mockRes();
    await SpeciesController.getOne(mockReq({ params: { id: 's1' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('200 for the owner', async () => {
    SpeciesModel.findById.mockResolvedValue(species);
    const res = mockRes();
    await SpeciesController.getOne(mockReq({ params: { id: 's1' }, user: OWNER }), res);
    expect(res.json).toHaveBeenCalledWith({ species });
  });

  it('200 for anyone when public', async () => {
    SpeciesModel.findById.mockResolvedValue({ ...species, is_public: true });
    const res = mockRes();
    await SpeciesController.getOne(mockReq({ params: { id: 's1' }, user: PLAYER }), res);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });
});

describe('SpeciesController.update / remove', () => {
  beforeEach(() => SpeciesModel.findById.mockResolvedValue(species));

  it('update 403 for a different GM (not the owner)', async () => {
    const res = mockRes();
    await SpeciesController.update(mockReq({ params: { id: 's1' }, body: { name: 'X' }, user: OTHER_GM }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(SpeciesModel.update).not.toHaveBeenCalled();
  });

  it('update 200 for the owner', async () => {
    SpeciesModel.update.mockResolvedValue({ ...species, name: 'Renamed' });
    const res = mockRes();
    await SpeciesController.update(mockReq({ params: { id: 's1' }, body: { name: 'Renamed' }, user: OWNER }), res);
    expect(res.json).toHaveBeenCalledWith({ species: { ...species, name: 'Renamed' } });
  });

  it('update 200 for admin overriding another GM\'s record', async () => {
    SpeciesModel.update.mockResolvedValue({ ...species, name: 'Renamed' });
    const res = mockRes();
    await SpeciesController.update(mockReq({ params: { id: 's1' }, body: { name: 'Renamed' }, user: ADMIN }), res);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it('remove 403 for a different GM', async () => {
    const res = mockRes();
    await SpeciesController.remove(mockReq({ params: { id: 's1' }, user: OTHER_GM }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('remove 204 for the owner', async () => {
    SpeciesModel.remove.mockResolvedValue(true);
    const res = mockRes();
    await SpeciesController.remove(mockReq({ params: { id: 's1' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('update 400 for an invalid health_die', async () => {
    const res = mockRes();
    await SpeciesController.update(mockReq({ params: { id: 's1' }, body: { name: 'X', health_die: 'd3' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(SpeciesModel.update).not.toHaveBeenCalled();
  });
});
