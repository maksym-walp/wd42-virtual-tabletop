jest.mock('../../models/faction.model');
jest.mock('../visibility', () => ({
  ...jest.requireActual('../visibility'),
  findVisibleNpc: jest.fn(),
  isPersonVisible: jest.fn(),
}));

const FactionModel = require('../../models/faction.model');
const { findVisibleNpc, isPersonVisible } = require('../visibility');
const { FactionController } = require('../faction.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, user = OWNER } = {}) {
  return { body, params, user };
}

const OWNER = { sub: 'gm-1', role: 'game_master' };
const OTHER_GM = { sub: 'gm-2', role: 'game_master' };
const PLAYER = { sub: 'p-1', role: 'user' };
const ADMIN = { sub: 'a-1', role: 'admin' };
const guild = { id: 'f1', created_by: 'gm-1', name: 'Guild', is_public: false };

beforeEach(() => {
  jest.clearAllMocks();
  FactionModel.findById.mockResolvedValue(guild);
});

describe('reading a private faction\'s leaders/members', () => {
  it('403 for someone who cannot read the faction', async () => {
    const res = mockRes();
    await FactionController.listMembers(mockReq({ params: { id: 'f1' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(FactionModel.findMembers).not.toHaveBeenCalled();

    const res2 = mockRes();
    await FactionController.listLeaders(mockReq({ params: { id: 'f1' }, user: PLAYER }), res2);
    expect(res2.status).toHaveBeenCalledWith(403);
  });

  it('200 for the owner', async () => {
    FactionModel.findMembers.mockResolvedValue([{ member_id: 'n1', role: 'Скарбник' }]);
    const res = mockRes();
    await FactionController.listMembers(mockReq({ params: { id: 'f1' } }), res);
    expect(res.json).toHaveBeenCalledWith({ members: [{ member_id: 'n1', role: 'Скарбник' }] });
  });
});

describe('FactionController.addMember', () => {
  it('403 for a different GM', async () => {
    const res = mockRes();
    await FactionController.addMember(mockReq({ params: { id: 'f1' }, body: { member_type: 'npc', member_id: 'n1' }, user: OTHER_GM }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('400 for an unknown member_type', async () => {
    const res = mockRes();
    await FactionController.addMember(mockReq({ params: { id: 'f1' }, body: { member_type: 'dragon', member_id: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('404 when the member is not visible', async () => {
    isPersonVisible.mockResolvedValue(false);
    const res = mockRes();
    await FactionController.addMember(mockReq({ params: { id: 'f1' }, body: { member_type: 'character', member_id: 'c1' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('201 with a trimmed role; empty role becomes null', async () => {
    isPersonVisible.mockResolvedValue(true);
    FactionModel.addMember.mockResolvedValue({ id: 'm1' });
    await FactionController.addMember(mockReq({ params: { id: 'f1' }, body: { member_type: 'npc', member_id: 'n1', role: '  Скарбник ' } }), mockRes());
    await FactionController.addMember(mockReq({ params: { id: 'f1' }, body: { member_type: 'npc', member_id: 'n2', role: '   ' } }), mockRes());
    expect(FactionModel.addMember.mock.calls).toEqual([['f1', 'npc', 'n1', 'Скарбник'], ['f1', 'npc', 'n2', null]]);
  });

  it('400 for an over-long role', async () => {
    const res = mockRes();
    await FactionController.addMember(mockReq({ params: { id: 'f1' }, body: { member_type: 'npc', member_id: 'n1', role: 'x'.repeat(201) } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('FactionController.updateMember', () => {
  it('updates the role', async () => {
    FactionModel.updateMemberRole.mockResolvedValue({ id: 'm1', role: 'Голова' });
    const res = mockRes();
    await FactionController.updateMember(mockReq({ params: { id: 'f1', memberType: 'npc', memberId: 'n1' }, body: { role: 'Голова' } }), res);
    expect(FactionModel.updateMemberRole).toHaveBeenCalledWith('f1', 'npc', 'n1', 'Голова');
    expect(res.json).toHaveBeenCalledWith({ member: { id: 'm1', role: 'Голова' } });
  });

  it('404 when not a member', async () => {
    FactionModel.updateMemberRole.mockResolvedValue(null);
    const res = mockRes();
    await FactionController.updateMember(mockReq({ params: { id: 'f1', memberType: 'npc', memberId: 'x' }, body: { role: 'a' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('FactionController.addLeader', () => {
  it('404 when the NPC is not visible', async () => {
    findVisibleNpc.mockResolvedValue(null);
    const res = mockRes();
    await FactionController.addLeader(mockReq({ params: { id: 'f1' }, body: { npc_entry_id: 'n1' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('FactionController.import', () => {
  it('403 for a non-GM/non-admin', async () => {
    const res = mockRes();
    await FactionController.import(mockReq({ body: [], user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(FactionModel.findAll).not.toHaveBeenCalled();
  });

  it('400 when the body is not an array', async () => {
    const res = mockRes();
    await FactionController.import(mockReq({ body: { name: 'X' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates a new faction when nothing matches', async () => {
    FactionModel.findAll.mockResolvedValue([guild]);
    FactionModel.create.mockResolvedValue({ ...guild, id: 'f2', name: 'Order' });
    const res = mockRes();
    await FactionController.import(mockReq({ body: [{ name: 'Order' }], user: OWNER }), res);
    expect(FactionModel.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Order' }));
    expect(FactionModel.update).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ imported: 1, created: 1, updated: 0 });
  });

  it('updates an owned faction when the id matches, keeping its symbol_url', async () => {
    FactionModel.findAll.mockResolvedValue([{ ...guild, symbol_url: '/uploads/guild.png' }]);
    const res = mockRes();
    await FactionController.import(mockReq({ body: [{ id: 'f1', name: 'Guild Renamed' }], user: OWNER }), res);
    expect(FactionModel.update).toHaveBeenCalledWith('f1', {
      name: 'Guild Renamed', description: null, isPublic: false, symbolUrl: '/uploads/guild.png',
    });
    expect(FactionModel.create).not.toHaveBeenCalled();
  });

  it('matches by name case-insensitively for the owner', async () => {
    FactionModel.findAll.mockResolvedValue([guild]);
    const res = mockRes();
    await FactionController.import(mockReq({ body: [{ name: ' guild ' }], user: OWNER }), res);
    expect(FactionModel.update).toHaveBeenCalledWith('f1', expect.objectContaining({ name: 'guild' }));
  });

  it('does not match a same-named faction owned by another GM', async () => {
    FactionModel.findAll.mockResolvedValue([guild]);
    FactionModel.create.mockResolvedValue({ ...guild, id: 'f2' });
    const res = mockRes();
    await FactionController.import(mockReq({ body: [{ name: 'Guild' }], user: OTHER_GM }), res);
    expect(FactionModel.update).not.toHaveBeenCalled();
    expect(FactionModel.create).toHaveBeenCalled();
  });

  it('lets admin match and update any faction by name', async () => {
    FactionModel.findAll.mockResolvedValue([guild]);
    const res = mockRes();
    await FactionController.import(mockReq({ body: [{ name: 'Guild' }], user: ADMIN }), res);
    expect(FactionModel.update).toHaveBeenCalledWith('f1', expect.objectContaining({ name: 'Guild' }));
  });
});
