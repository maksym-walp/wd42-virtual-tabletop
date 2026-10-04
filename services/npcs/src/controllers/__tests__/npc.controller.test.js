jest.mock('../../models/npc.model');

const NpcModel = require('../../models/npc.model');
const NpcController = require('../npc.controller');

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
const tom = { id: 'n1', created_by: 'gm-1', name: 'Old Tom', is_public: true, private_notes: 'secret', ...ATTRS };

beforeEach(() => jest.clearAllMocks());

describe('NpcController.create', () => {
  it('403 for a player', async () => {
    const res = mockRes();
    await NpcController.create(mockReq({ body: { name: 'X', ...ATTRS }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it.each([
    ['gender', { gender: 'robot' }],
    ['age', { age: -1 }],
    ['birth_day', { birth_day: 0 }],
    ['death_day', { death_day: 0 }],
    ['death_year', { death_year: 1.5 }],
    ['health_die_override', { health_die_override: 'd3' }],
  ])('400 for an invalid %s', async (_, extra) => {
    const res = mockRes();
    await NpcController.create(mockReq({ body: { name: 'X', ...ATTRS, ...extra } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(NpcModel.create).not.toHaveBeenCalled();
  });

  it('201 passing birth and death dates through', async () => {
    NpcModel.create.mockResolvedValue(tom);
    const res = mockRes();
    await NpcController.create(mockReq({
      body: {
        name: 'Old Tom', motivation: 'gold', ...ATTRS,
        birth_calendar_id: 'cal', birth_year: 40, birth_month_id: 'm1', birth_day: 2,
        death_calendar_id: 'cal', death_year: 101, death_month_id: 'm2', death_day: 14,
      },
    }), res);
    expect(NpcModel.create).toHaveBeenCalledWith(expect.objectContaining({
      createdBy: 'gm-1', motivation: 'gold', attributes: ATTRS,
      birthYear: 40, birthDay: 2, deathCalendarId: 'cal', deathYear: 101, deathMonthId: 'm2', deathDay: 14,
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('NpcController private notes', () => {
  it('strips private_notes for a plain player viewing a public NPC', async () => {
    NpcModel.findById.mockResolvedValue(tom);
    const res = mockRes();
    await NpcController.getOne(mockReq({ params: { id: 'n1' }, user: PLAYER }), res);
    expect(res.json.mock.calls[0][0].npc).not.toHaveProperty('private_notes');
  });

  it('keeps private_notes for any game master', async () => {
    NpcModel.findById.mockResolvedValue(tom);
    const res = mockRes();
    await NpcController.getOne(mockReq({ params: { id: 'n1' }, user: OTHER_GM }), res);
    expect(res.json.mock.calls[0][0].npc.private_notes).toBe('secret');
  });

  it('strips them in the list too', async () => {
    NpcModel.findAll.mockResolvedValue([tom]);
    const res = mockRes();
    await NpcController.list(mockReq({ user: PLAYER }), res);
    expect(res.json.mock.calls[0][0].npcs[0]).not.toHaveProperty('private_notes');
  });
});

describe('NpcController.getOne', () => {
  it('403 on someone else\'s private NPC', async () => {
    NpcModel.findById.mockResolvedValue({ ...tom, is_public: false });
    const res = mockRes();
    await NpcController.getOne(mockReq({ params: { id: 'n1' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('NpcController.update / remove', () => {
  beforeEach(() => NpcModel.findById.mockResolvedValue(tom));

  it('403 for a different GM', async () => {
    const res = mockRes();
    await NpcController.update(mockReq({ params: { id: 'n1' }, body: { name: 'Y', ...ATTRS }, user: OTHER_GM }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('admin may update anyone\'s NPC', async () => {
    NpcModel.update.mockResolvedValue(tom);
    const res = mockRes();
    await NpcController.update(mockReq({ params: { id: 'n1' }, body: { name: 'Tom', ...ATTRS }, user: ADMIN }), res);
    expect(NpcModel.update).toHaveBeenCalledWith('n1', expect.objectContaining({ name: 'Tom', deathYear: null }));
  });

  it('204 on delete by the owner', async () => {
    const res = mockRes();
    await NpcController.remove(mockReq({ params: { id: 'n1' } }), res);
    expect(NpcModel.remove).toHaveBeenCalledWith('n1');
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

describe('NpcController.updateHealth', () => {
  beforeEach(() => NpcModel.findById.mockResolvedValue(tom));

  it('400 for a non-positive roll', async () => {
    const res = mockRes();
    await NpcController.updateHealth(mockReq({ params: { id: 'n1' }, body: { rolled_health: 0 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('stores a roll, null clears it', async () => {
    NpcModel.updateRolledHealth.mockResolvedValue(tom);
    await NpcController.updateHealth(mockReq({ params: { id: 'n1' }, body: { rolled_health: 57 } }), mockRes());
    await NpcController.updateHealth(mockReq({ params: { id: 'n1' }, body: { rolled_health: null } }), mockRes());
    expect(NpcModel.updateRolledHealth.mock.calls).toEqual([['n1', 57], ['n1', null]]);
  });
});
