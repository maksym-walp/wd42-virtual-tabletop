jest.mock('../../models/entry.model');

const EntryModel = require('../../models/entry.model');
const EntryController = require('../entry.controller');
const { decorateEntry } = require('../../dto/entry.dto');

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
const npcEntry = { id: 'e1', entity_type: 'npc', created_by: 'gm-1', name: 'Old Tom', is_public: false, ...ATTRS };

beforeEach(() => jest.clearAllMocks());

describe('EntryController.create', () => {
  it('403 for a non-GM/non-admin', async () => {
    const res = mockRes();
    await EntryController.create(mockReq({ body: { name: 'X', entity_type: 'npc', ...ATTRS }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(EntryModel.create).not.toHaveBeenCalled();
  });

  it('400 for an invalid entity_type', async () => {
    const res = mockRes();
    await EntryController.create(mockReq({ body: { name: 'X', entity_type: 'dragon', ...ATTRS }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(EntryModel.create).not.toHaveBeenCalled();
  });

  it('400 when an attribute is out of the 1..6 range', async () => {
    const res = mockRes();
    await EntryController.create(mockReq({ body: { name: 'X', entity_type: 'npc', ...ATTRS, wisdom: 7 }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(EntryModel.create).not.toHaveBeenCalled();
  });

  it('400 when an attribute is not an integer', async () => {
    const res = mockRes();
    await EntryController.create(mockReq({ body: { name: 'X', entity_type: 'npc', ...ATTRS, charisma: 2.5 }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('201 for an npc, keeping motivation/backstory/faction, stripping history', async () => {
    EntryModel.create.mockResolvedValue(npcEntry);
    const res = mockRes();
    await EntryController.create(mockReq({
      body: { name: 'Old Tom', entity_type: 'npc', motivation: 'gold', backstory: 'sailor', faction: 'Thieves Guild', history: 'sneaked in', ...ATTRS },
      user: OWNER,
    }), res);
    expect(EntryModel.create).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'npc', motivation: 'gold', backstory: 'sailor', faction: 'Thieves Guild', history: null, attributes: ATTRS,
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('strips motivation/backstory/faction for a creature regardless of what the client sends, keeps history', async () => {
    EntryModel.create.mockResolvedValue({ ...npcEntry, entity_type: 'creature' });
    const res = mockRes();
    await EntryController.create(mockReq({
      body: { name: 'Wolf', entity_type: 'creature', motivation: 'hunger', backstory: 'lone wolf', faction: 'Pack', history: 'born in the woods', ...ATTRS },
      user: OWNER,
    }), res);
    expect(EntryModel.create).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'creature', motivation: null, backstory: null, faction: null, history: 'born in the woods',
    }));
  });
});

describe('EntryController.getOne', () => {
  it('404 when missing', async () => {
    EntryModel.findById.mockResolvedValue(null);
    const res = mockRes();
    await EntryController.getOne(mockReq({ params: { id: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('403 for a non-owner, non-admin on a private record', async () => {
    EntryModel.findById.mockResolvedValue(npcEntry);
    const res = mockRes();
    await EntryController.getOne(mockReq({ params: { id: 'e1' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('200 for the owner, entry carries computed skill dice and health', async () => {
    EntryModel.findById.mockResolvedValue(npcEntry);
    const res = mockRes();
    await EntryController.getOne(mockReq({ params: { id: 'e1' }, user: OWNER }), res);
    expect(res.json).toHaveBeenCalledWith({ entry: decorateEntry(npcEntry) });
    const { skills, health } = res.json.mock.calls[0][0].entry;
    expect(skills).toHaveLength(20);
    expect(skills.find((s) => s.key === 'evasion')).toEqual(
      expect.objectContaining({ attribute: 'dexterity', dice: 'd8' })
    );
    expect(health).toEqual({ die: 'd6', count: 18, formula: '18d6', rolled: null });
  });
});

describe('EntryController.update / remove', () => {
  beforeEach(() => EntryModel.findById.mockResolvedValue(npcEntry));

  it('update 403 for a different GM (not the owner)', async () => {
    const res = mockRes();
    await EntryController.update(mockReq({ params: { id: 'e1' }, body: { name: 'X', ...ATTRS }, user: OTHER_GM }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(EntryModel.update).not.toHaveBeenCalled();
  });

  it('update 200 for the owner, entity_type not switchable', async () => {
    EntryModel.update.mockResolvedValue({ ...npcEntry, name: 'Renamed' });
    const res = mockRes();
    await EntryController.update(mockReq({
      params: { id: 'e1' }, body: { name: 'Renamed', entity_type: 'creature', ...ATTRS }, user: OWNER,
    }), res);
    expect(EntryModel.update).toHaveBeenCalledWith('e1', expect.objectContaining({ attributes: ATTRS }));
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it('update 200 for admin overriding another GM\'s record', async () => {
    EntryModel.update.mockResolvedValue({ ...npcEntry, name: 'Renamed' });
    const res = mockRes();
    await EntryController.update(mockReq({ params: { id: 'e1' }, body: { name: 'Renamed', ...ATTRS }, user: ADMIN }), res);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it('remove 204 for the owner', async () => {
    EntryModel.remove.mockResolvedValue(true);
    const res = mockRes();
    await EntryController.remove(mockReq({ params: { id: 'e1' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

describe('EntryController.updateHealth', () => {
  beforeEach(() => EntryModel.findById.mockResolvedValue(npcEntry));

  it('404 when the entry does not exist', async () => {
    EntryModel.findById.mockResolvedValue(null);
    const res = mockRes();
    await EntryController.updateHealth(mockReq({ params: { id: 'x' }, body: { rolled_health: 10 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(EntryModel.updateRolledHealth).not.toHaveBeenCalled();
  });

  it('403 for a different GM (not the owner)', async () => {
    const res = mockRes();
    await EntryController.updateHealth(mockReq({ params: { id: 'e1' }, body: { rolled_health: 10 }, user: OTHER_GM }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(EntryModel.updateRolledHealth).not.toHaveBeenCalled();
  });

  it('400 for a creature — persistent health is npc-only', async () => {
    EntryModel.findById.mockResolvedValue({ ...npcEntry, entity_type: 'creature' });
    const res = mockRes();
    await EntryController.updateHealth(mockReq({ params: { id: 'e1' }, body: { rolled_health: 10 }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(EntryModel.updateRolledHealth).not.toHaveBeenCalled();
  });

  it('400 for a non-positive or non-integer rolled_health', async () => {
    const res1 = mockRes();
    await EntryController.updateHealth(mockReq({ params: { id: 'e1' }, body: { rolled_health: 0 }, user: OWNER }), res1);
    expect(res1.status).toHaveBeenCalledWith(400);

    const res2 = mockRes();
    await EntryController.updateHealth(mockReq({ params: { id: 'e1' }, body: { rolled_health: 12.5 }, user: OWNER }), res2);
    expect(res2.status).toHaveBeenCalledWith(400);
    expect(EntryModel.updateRolledHealth).not.toHaveBeenCalled();
  });

  it('200 persists the rolled total for the owner', async () => {
    EntryModel.updateRolledHealth.mockResolvedValue({ ...npcEntry, rolled_health: 143 });
    const res = mockRes();
    await EntryController.updateHealth(mockReq({ params: { id: 'e1' }, body: { rolled_health: 143 }, user: OWNER }), res);
    expect(EntryModel.updateRolledHealth).toHaveBeenCalledWith('e1', 143);
    expect(res.json.mock.calls[0][0].entry.health.rolled).toBe(143);
  });

  it('200 for admin overriding another GM\'s npc', async () => {
    EntryModel.updateRolledHealth.mockResolvedValue({ ...npcEntry, rolled_health: 50 });
    const res = mockRes();
    await EntryController.updateHealth(mockReq({ params: { id: 'e1' }, body: { rolled_health: 50 }, user: ADMIN }), res);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it('allows clearing a previous roll with null', async () => {
    EntryModel.updateRolledHealth.mockResolvedValue({ ...npcEntry, rolled_health: null });
    const res = mockRes();
    await EntryController.updateHealth(mockReq({ params: { id: 'e1' }, body: { rolled_health: null }, user: OWNER }), res);
    expect(EntryModel.updateRolledHealth).toHaveBeenCalledWith('e1', null);
    expect(res.status).not.toHaveBeenCalledWith(400);
  });
});

describe('EntryController.list', () => {
  it('400 for an invalid entity_type filter', async () => {
    const res = mockRes();
    await EntryController.list(mockReq({ query: { entity_type: 'dragon' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(EntryModel.findAll).not.toHaveBeenCalled();
  });

  it('passes a valid entity_type filter through', async () => {
    EntryModel.findAll.mockResolvedValue([]);
    const res = mockRes();
    await EntryController.list(mockReq({ query: { entity_type: 'creature' } }), res);
    expect(EntryModel.findAll).toHaveBeenCalledWith('gm-1', false, 'creature');
  });
});
