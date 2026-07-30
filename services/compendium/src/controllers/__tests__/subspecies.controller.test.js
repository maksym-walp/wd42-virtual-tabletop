jest.mock('../../models/subspecies.model');

const SubspeciesModel = require('../../models/subspecies.model');
const SubspeciesController = require('../subspecies.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, query = {}, user = OWNER } = {}) {
  return { body, params, query, user };
}

const OWNER = { sub: 'gm-1', role: 'game_master' };
const OTHER_GM = { sub: 'gm-2', role: 'game_master' };
const PLAYER = { sub: 'p-1', role: 'user' };
const subspecies = { id: 'sub1', species_id: 's1', created_by: 'gm-1', name: 'Wood Elf', is_public: false };

beforeEach(() => jest.clearAllMocks());

describe('SubspeciesController.create', () => {
  it('403 for a non-GM/non-admin', async () => {
    const res = mockRes();
    await SubspeciesController.create(mockReq({ body: { name: 'X', species_id: 's1' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(SubspeciesModel.create).not.toHaveBeenCalled();
  });

  it('400 when species_id missing', async () => {
    const res = mockRes();
    await SubspeciesController.create(mockReq({ body: { name: 'X' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(SubspeciesModel.create).not.toHaveBeenCalled();
  });

  it('201 for a GM, mapping body -> model fields', async () => {
    SubspeciesModel.create.mockResolvedValue(subspecies);
    const res = mockRes();
    await SubspeciesController.create(mockReq({ body: { name: 'Wood Elf', species_id: 's1', health_die: 'd8' }, user: OWNER }), res);
    expect(SubspeciesModel.create).toHaveBeenCalledWith({
      createdBy: 'gm-1', speciesId: 's1', name: 'Wood Elf', description: null, isPublic: false, healthDie: 'd8',
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('400 for an invalid health_die', async () => {
    const res = mockRes();
    await SubspeciesController.create(mockReq({ body: { name: 'X', species_id: 's1', health_die: 'd3' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(SubspeciesModel.create).not.toHaveBeenCalled();
  });
});

describe('SubspeciesController.update / remove', () => {
  beforeEach(() => SubspeciesModel.findById.mockResolvedValue(subspecies));

  it('update 403 for a different GM (not the owner)', async () => {
    const res = mockRes();
    await SubspeciesController.update(mockReq({ params: { id: 'sub1' }, body: { name: 'X' }, user: OTHER_GM }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('remove 204 for the owner', async () => {
    SubspeciesModel.remove.mockResolvedValue(true);
    const res = mockRes();
    await SubspeciesController.remove(mockReq({ params: { id: 'sub1' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
