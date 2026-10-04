jest.mock('../../models/npc.model');
jest.mock('../../models/relationship.model');
jest.mock('../visibility', () => ({ ...jest.requireActual('../visibility'), isPersonVisible: jest.fn() }));

const NpcModel = require('../../models/npc.model');
const RelationshipModel = require('../../models/relationship.model');
const { isPersonVisible } = require('../visibility');
const RelationshipController = require('../relationship.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, user = OWNER } = {}) {
  return { body, params, user };
}

const OWNER = { sub: 'gm-1', role: 'game_master' };
const OTHER_GM = { sub: 'gm-2', role: 'game_master' };
const PLAYER = { sub: 'p-1', role: 'user' };
const npc = { id: 'n1', created_by: 'gm-1', is_public: true };

beforeEach(() => {
  jest.clearAllMocks();
  NpcModel.findById.mockResolvedValue(npc);
});

describe('RelationshipController.list', () => {
  it('returns outgoing and incoming, filtered by the viewer', async () => {
    RelationshipModel.findOutgoing.mockResolvedValue([{ id: 'r1' }]);
    RelationshipModel.findIncoming.mockResolvedValue([{ id: 'r2' }]);
    const res = mockRes();
    await RelationshipController.list(mockReq({ params: { id: 'n1' }, user: PLAYER }), res);
    expect(RelationshipModel.findOutgoing).toHaveBeenCalledWith('n1', 'p-1', false);
    expect(res.json).toHaveBeenCalledWith({ outgoing: [{ id: 'r1' }], incoming: [{ id: 'r2' }] });
  });

  it('403 for a private NPC the viewer cannot read', async () => {
    NpcModel.findById.mockResolvedValue({ ...npc, is_public: false });
    const res = mockRes();
    await RelationshipController.list(mockReq({ params: { id: 'n1' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('RelationshipController.create', () => {
  const body = { target_type: 'character', target_id: 'c1', label: ' наставник ', note: '' };

  it('403 for a GM who does not own the NPC', async () => {
    const res = mockRes();
    await RelationshipController.create(mockReq({ params: { id: 'n1' }, body, user: OTHER_GM }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it.each([
    ['bad target_type', { ...body, target_type: 'creature' }],
    ['missing label', { ...body, label: '  ' }],
    ['self link', { target_type: 'npc', target_id: 'n1', label: 'я' }],
  ])('400 for %s', async (_, b) => {
    const res = mockRes();
    await RelationshipController.create(mockReq({ params: { id: 'n1' }, body: b }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(RelationshipModel.create).not.toHaveBeenCalled();
  });

  it('404 when the target is not visible', async () => {
    isPersonVisible.mockResolvedValue(false);
    const res = mockRes();
    await RelationshipController.create(mockReq({ params: { id: 'n1' }, body }), res);
    expect(isPersonVisible).toHaveBeenCalledWith('character', 'c1', OWNER);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('409 for a duplicate target', async () => {
    isPersonVisible.mockResolvedValue(true);
    RelationshipModel.create.mockResolvedValue(null);
    const res = mockRes();
    await RelationshipController.create(mockReq({ params: { id: 'n1' }, body }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('201 with trimmed label and empty note as null', async () => {
    isPersonVisible.mockResolvedValue(true);
    RelationshipModel.create.mockResolvedValue({ id: 'r1' });
    const res = mockRes();
    await RelationshipController.create(mockReq({ params: { id: 'n1' }, body }), res);
    expect(RelationshipModel.create).toHaveBeenCalledWith('n1', { targetType: 'character', targetId: 'c1', label: 'наставник', note: null });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('RelationshipController.update / remove', () => {
  it('404 for a relationship of another NPC', async () => {
    RelationshipModel.update.mockResolvedValue(null);
    const res = mockRes();
    await RelationshipController.update(mockReq({ params: { id: 'n1', relationshipId: 'r9' }, body: { label: 'брат' } }), res);
    expect(RelationshipModel.update).toHaveBeenCalledWith('n1', 'r9', { label: 'брат', note: null });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('204 on remove', async () => {
    RelationshipModel.remove.mockResolvedValue(true);
    const res = mockRes();
    await RelationshipController.remove(mockReq({ params: { id: 'n1', relationshipId: 'r1' } }), res);
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
