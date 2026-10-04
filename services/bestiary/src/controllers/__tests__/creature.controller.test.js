jest.mock('../../models/creature.model');

const CreatureModel = require('../../models/creature.model');
const CreatureController = require('../creature.controller');

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
const ATTRS = { dexterity: 3, body: 4, intelligence: 2, wisdom: 5, charisma: 1 };
const wolf = { id: 'c1', created_by: 'gm-1', name: 'Wolf', is_public: false, health_die: 'd8', ...ATTRS };

beforeEach(() => jest.clearAllMocks());

describe('CreatureController.create', () => {
  it('403 for a non-GM/non-admin', async () => {
    const res = mockRes();
    await CreatureController.create(mockReq({ body: { name: 'X', ...ATTRS }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CreatureModel.create).not.toHaveBeenCalled();
  });

  it('400 when name is missing', async () => {
    const res = mockRes();
    await CreatureController.create(mockReq({ body: { name: '  ', ...ATTRS } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 when an attribute is out of the 1..6 range', async () => {
    const res = mockRes();
    await CreatureController.create(mockReq({ body: { name: 'X', ...ATTRS, wisdom: 7 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(CreatureModel.create).not.toHaveBeenCalled();
  });

  it('400 for an unknown health_die_override', async () => {
    const res = mockRes();
    await CreatureController.create(mockReq({ body: { name: 'X', ...ATTRS, health_die_override: 'd7' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('201 with own health die override, history kept, decorated health', async () => {
    CreatureModel.create.mockResolvedValue({ ...wolf, health_die: 'd12', health_die_override: 'd12' });
    const res = mockRes();
    await CreatureController.create(mockReq({
      body: { name: ' Wolf ', history: 'born in the woods', health_die_override: 'd12', ...ATTRS },
    }), res);
    expect(CreatureModel.create).toHaveBeenCalledWith(expect.objectContaining({
      createdBy: 'gm-1', name: 'Wolf', history: 'born in the woods', healthDieOverride: 'd12', attributes: ATTRS,
    }));
    expect(res.status).toHaveBeenCalledWith(201);
    const { creature } = res.json.mock.calls[0][0];
    expect(creature.health).toEqual({ die: 'd12', count: 18, formula: '18d12', rolled: null });
    expect(creature.skills).toHaveLength(20);
  });
});

describe('CreatureController.getOne', () => {
  it('404 when missing', async () => {
    CreatureModel.findById.mockResolvedValue(null);
    const res = mockRes();
    await CreatureController.getOne(mockReq({ params: { id: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('403 on someone else\'s private creature', async () => {
    CreatureModel.findById.mockResolvedValue(wolf);
    const res = mockRes();
    await CreatureController.getOne(mockReq({ params: { id: 'c1' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('200 for an admin on a private creature', async () => {
    CreatureModel.findById.mockResolvedValue(wolf);
    const res = mockRes();
    await CreatureController.getOne(mockReq({ params: { id: 'c1' }, user: ADMIN }), res);
    expect(res.json).toHaveBeenCalledWith({ creature: expect.objectContaining({ id: 'c1' }) });
  });
});

describe('CreatureController.update / remove', () => {
  beforeEach(() => CreatureModel.findById.mockResolvedValue(wolf));

  it('403 for a different GM', async () => {
    const res = mockRes();
    await CreatureController.update(mockReq({ params: { id: 'c1' }, body: { name: 'Y', ...ATTRS }, user: OTHER_GM }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CreatureModel.update).not.toHaveBeenCalled();
  });

  it('updates for the owner', async () => {
    CreatureModel.update.mockResolvedValue(wolf);
    const res = mockRes();
    await CreatureController.update(mockReq({ params: { id: 'c1' }, body: { name: 'Wolf', ...ATTRS } }), res);
    expect(CreatureModel.update).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'Wolf', healthDieOverride: null }));
  });

  it('204 on delete by the owner', async () => {
    const res = mockRes();
    await CreatureController.remove(mockReq({ params: { id: 'c1' } }), res);
    expect(CreatureModel.remove).toHaveBeenCalledWith('c1');
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

describe('CreatureController.list', () => {
  it('passes the admin flag through and decorates every row', async () => {
    CreatureModel.findAll.mockResolvedValue([wolf]);
    const res = mockRes();
    await CreatureController.list(mockReq({ user: ADMIN }), res);
    expect(CreatureModel.findAll).toHaveBeenCalledWith('a-1', true);
    expect(res.json.mock.calls[0][0].creatures[0].health.formula).toBe('18d8');
  });
});
