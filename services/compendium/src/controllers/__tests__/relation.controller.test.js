jest.mock('../../models/entry.model');
jest.mock('../../models/entry-equipment.model');
jest.mock('../../models/entry-spell.model');
jest.mock('../../models/catalog.model');

const EntryModel = require('../../models/entry.model');
const EntryEquipmentModel = require('../../models/entry-equipment.model');
const EntrySpellModel = require('../../models/entry-spell.model');
const { isVisibleToUser, isEquipmentVisibleToUser } = require('../../models/catalog.model');
const createRelationController = require('../relation.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, user = OWNER } = {}) {
  return { body, params, user };
}

const OWNER = { sub: 'gm-1', role: 'game_master' };
const OTHER_GM = { sub: 'gm-2', role: 'game_master' };
const PLAYER = { sub: 'p-1', role: 'user' };
const npcEntry = { id: 'e1', entity_type: 'npc', created_by: 'gm-1', is_public: false };

beforeEach(() => jest.clearAllMocks());

// Exercise the factory through a real instantiation (equipment), rather than testing
// createRelationController abstractly — this is exactly how routes/entry.routes.js uses it.
const EquipmentRelationController = createRelationController({
  RelationModel: EntryEquipmentModel,
  checkVisible: isEquipmentVisibleToUser,
  bodyField: 'equipment_id',
  paramField: 'equipmentId',
  listKey: 'equipment',
  itemKey: 'item',
  notFoundMessage: 'Спорядження не знайдено',
});

describe('relation controller — list', () => {
  it('404 when the entry is missing', async () => {
    EntryModel.findById.mockResolvedValue(null);
    const res = mockRes();
    await EquipmentRelationController.list(mockReq({ params: { id: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('403 for a non-owner, non-admin on a private entry', async () => {
    EntryModel.findById.mockResolvedValue(npcEntry);
    const res = mockRes();
    await EquipmentRelationController.list(mockReq({ params: { id: 'e1' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(EntryEquipmentModel.findAllByEntry).not.toHaveBeenCalled();
  });

  it('200 with the resolved list for the owner', async () => {
    EntryModel.findById.mockResolvedValue(npcEntry);
    EntryEquipmentModel.findAllByEntry.mockResolvedValue([{ id: 'link1' }]);
    const res = mockRes();
    await EquipmentRelationController.list(mockReq({ params: { id: 'e1' }, user: OWNER }), res);
    expect(res.json).toHaveBeenCalledWith({ equipment: [{ id: 'link1' }] });
  });
});

describe('relation controller — add', () => {
  beforeEach(() => EntryModel.findById.mockResolvedValue(npcEntry));

  it('403 for a different GM (not the entry owner)', async () => {
    const res = mockRes();
    await EquipmentRelationController.add(mockReq({ params: { id: 'e1' }, body: { equipment_id: 'eq1' }, user: OTHER_GM }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(EntryEquipmentModel.add).not.toHaveBeenCalled();
  });

  it('400 when the body field is missing', async () => {
    const res = mockRes();
    await EquipmentRelationController.add(mockReq({ params: { id: 'e1' }, body: {}, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('404 when the external item is not visible to the owner', async () => {
    isEquipmentVisibleToUser.mockResolvedValue(false);
    const res = mockRes();
    await EquipmentRelationController.add(mockReq({ params: { id: 'e1' }, body: { equipment_id: 'eq1' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(EntryEquipmentModel.add).not.toHaveBeenCalled();
  });

  it('201 and links when visible', async () => {
    isEquipmentVisibleToUser.mockResolvedValue(true);
    EntryEquipmentModel.add.mockResolvedValue({ id: 'link1', entry_id: 'e1', equipment_id: 'eq1' });
    const res = mockRes();
    await EquipmentRelationController.add(mockReq({ params: { id: 'e1' }, body: { equipment_id: 'eq1' }, user: OWNER }), res);
    expect(EntryEquipmentModel.add).toHaveBeenCalledWith('e1', 'eq1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ item: { id: 'link1', entry_id: 'e1', equipment_id: 'eq1' } });
  });
});

describe('relation controller — remove', () => {
  beforeEach(() => EntryModel.findById.mockResolvedValue(npcEntry));

  it('403 for a different GM', async () => {
    const res = mockRes();
    await EquipmentRelationController.remove(mockReq({ params: { id: 'e1', equipmentId: 'eq1' }, user: OTHER_GM }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('404 when the link does not exist', async () => {
    EntryEquipmentModel.remove.mockResolvedValue(false);
    const res = mockRes();
    await EquipmentRelationController.remove(mockReq({ params: { id: 'e1', equipmentId: 'gone' }, user: OWNER }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('200 for the owner on success', async () => {
    EntryEquipmentModel.remove.mockResolvedValue(true);
    const res = mockRes();
    await EquipmentRelationController.remove(mockReq({ params: { id: 'e1', equipmentId: 'eq1' }, user: OWNER }), res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});

describe('a different relation config (spells) uses its own field/key names', () => {
  const SpellRelationController = createRelationController({
    RelationModel: EntrySpellModel,
    checkVisible: (id, userId) => isVisibleToUser('spellbook.spells', id, userId),
    bodyField: 'spell_id',
    paramField: 'spellId',
    listKey: 'spells',
    itemKey: 'spell',
    notFoundMessage: 'Заклинання не знайдено',
  });

  it('400 message references spell_id, not equipment_id', async () => {
    EntryModel.findById.mockResolvedValue(npcEntry);
    const res = mockRes();
    await SpellRelationController.add(mockReq({ params: { id: 'e1' }, body: {}, user: OWNER }), res);
    expect(res.json).toHaveBeenCalledWith({ message: 'spell_id є обовʼязковим' });
  });

  it('201 response is keyed "spell"', async () => {
    EntryModel.findById.mockResolvedValue(npcEntry);
    isVisibleToUser.mockResolvedValue(true);
    EntrySpellModel.add.mockResolvedValue({ id: 'link2' });
    const res = mockRes();
    await SpellRelationController.add(mockReq({ params: { id: 'e1' }, body: { spell_id: 'sp1' }, user: OWNER }), res);
    expect(res.json).toHaveBeenCalledWith({ spell: { id: 'link2' } });
  });
});
