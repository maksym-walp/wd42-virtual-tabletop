jest.mock('../../models/faction.model');
jest.mock('../visibility', () => ({ ...jest.requireActual('../visibility'), findVisibleNpc: jest.fn() }));

const FactionModel = require('../../models/faction.model');
const { findVisibleNpc } = require('../visibility');
const NpcFactionController = require('../npc-faction.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, user = OWNER } = {}) {
  return { body, params, user };
}

const OWNER = { sub: 'gm-1', role: 'game_master' };
const OTHER_GM = { sub: 'gm-2', role: 'game_master' };
const ADMIN = { sub: 'a-1', role: 'admin' };
const npc = { id: 'n1', created_by: 'gm-1', is_public: true };
const guild = { id: 'f1', created_by: 'gm-1', is_public: true };

beforeEach(() => {
  jest.clearAllMocks();
  findVisibleNpc.mockResolvedValue(npc);
  FactionModel.findById.mockResolvedValue(guild);
});

describe('NpcFactionController.list', () => {
  it('404 when the NPC is not visible', async () => {
    findVisibleNpc.mockResolvedValue(null);
    const res = mockRes();
    await NpcFactionController.list(mockReq({ params: { id: 'n1' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns memberships with can_edit and without created_by', async () => {
    FactionModel.findMembershipsByNpc.mockResolvedValue([
      { id: 'f1', name: 'Guild', created_by: 'gm-1', role: 'Скарбник', is_member: true, is_leader: true },
      { id: 'f2', name: 'Other', created_by: 'gm-2', role: null, is_member: true, is_leader: false },
    ]);
    const res = mockRes();
    await NpcFactionController.list(mockReq({ params: { id: 'n1' } }), res);
    expect(FactionModel.findMembershipsByNpc).toHaveBeenCalledWith('n1', 'gm-1', false);
    const { factions } = res.json.mock.calls[0][0];
    expect(factions.map((f) => f.can_edit)).toEqual([true, false]);
    expect(factions[0]).not.toHaveProperty('created_by');
  });
});

describe('NpcFactionController.add', () => {
  it('400 without faction_id', async () => {
    const res = mockRes();
    await NpcFactionController.add(mockReq({ params: { id: 'n1' }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('403 when the acting GM does not own the faction', async () => {
    const res = mockRes();
    await NpcFactionController.add(mockReq({ params: { id: 'n1' }, body: { faction_id: 'f1' }, user: OTHER_GM }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(FactionModel.addMember).not.toHaveBeenCalled();
  });

  it('writes the same faction_members row the faction page uses', async () => {
    FactionModel.addMember.mockResolvedValue({ id: 'm1' });
    const res = mockRes();
    await NpcFactionController.add(mockReq({ params: { id: 'n1' }, body: { faction_id: 'f1', role: 'Шпигун' } }), res);
    expect(FactionModel.addMember).toHaveBeenCalledWith('f1', 'npc', 'n1', 'Шпигун');
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('NpcFactionController.update / remove', () => {
  it('updates the role (admin on anyone\'s faction)', async () => {
    FactionModel.updateMemberRole.mockResolvedValue({ id: 'm1' });
    const res = mockRes();
    await NpcFactionController.update(mockReq({ params: { id: 'n1', factionId: 'f1' }, body: { role: 'Голова' }, user: ADMIN }), res);
    expect(FactionModel.updateMemberRole).toHaveBeenCalledWith('f1', 'npc', 'n1', 'Голова');
  });

  it('404 when the NPC is not a member', async () => {
    FactionModel.updateMemberRole.mockResolvedValue(null);
    const res = mockRes();
    await NpcFactionController.update(mockReq({ params: { id: 'n1', factionId: 'f1' }, body: { role: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('204 when leaving a faction', async () => {
    const res = mockRes();
    await NpcFactionController.remove(mockReq({ params: { id: 'n1', factionId: 'f1' } }), res);
    expect(FactionModel.removeMember).toHaveBeenCalledWith('f1', 'npc', 'n1');
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
