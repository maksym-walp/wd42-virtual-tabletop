jest.mock('../../models/collection.model');
jest.mock('../../models/creature.model');

const CollectionModel = require('../../models/collection.model');
const CreatureModel = require('../../models/creature.model');
const CollectionController = require('../collection.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, query = {}, user = OWNER } = {}) {
  return { body, params, query, user };
}

const OWNER = { sub: 'u1', role: 'game_master' };
const ADMIN = { sub: 'a1', role: 'admin' };
const collection = { id: 'c1', created_by: 'u1', name: 'Bandit camp', is_public: false };

beforeEach(() => jest.clearAllMocks());

describe('CollectionController.create', () => {
  it('any authenticated user may create — no role gate', async () => {
    CollectionModel.create.mockResolvedValue(collection);
    const res = mockRes();
    await CollectionController.create(mockReq({ body: { name: 'Bandit camp' } }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ collection });
  });

  it('400 when name missing', async () => {
    const res = mockRes();
    await CollectionController.create(mockReq({ body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(CollectionModel.create).not.toHaveBeenCalled();
  });
});

describe('CollectionController.getOne / getPublic', () => {
  it('404 when missing', async () => {
    CollectionModel.findById.mockResolvedValue(null);
    const res = mockRes();
    await CollectionController.getOne(mockReq({ params: { id: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('getPublic 404 when private or missing', async () => {
    CollectionModel.findPublicById.mockResolvedValue(null);
    const res = mockRes();
    await CollectionController.getPublic(mockReq({ params: { id: 'c1' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('CollectionController.update / remove', () => {
  it('404 when not found or not owned', async () => {
    CollectionModel.update.mockResolvedValue(null);
    const res = mockRes();
    await CollectionController.update(mockReq({ params: { id: 'c1' }, body: { name: 'X' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('200 for the owner', async () => {
    CollectionModel.update.mockResolvedValue({ ...collection, name: 'Renamed' });
    const res = mockRes();
    await CollectionController.update(mockReq({ params: { id: 'c1' }, body: { name: 'Renamed' }, user: OWNER }), res);
    expect(res.json).toHaveBeenCalledWith({ collection: { ...collection, name: 'Renamed' } });
  });

  it('remove 404 when not found or not owned', async () => {
    CollectionModel.delete.mockResolvedValue(false);
    const res = mockRes();
    await CollectionController.remove(mockReq({ params: { id: 'c1' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('remove 200 for admin override', async () => {
    CollectionModel.delete.mockResolvedValue(true);
    const res = mockRes();
    await CollectionController.remove(mockReq({ params: { id: 'c1' }, user: ADMIN }), res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});

describe('CollectionController.addItem / removeItem', () => {
  it('400 when creature_id missing', async () => {
    const res = mockRes();
    await CollectionController.addItem(mockReq({ params: { id: 'c1' }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(CollectionModel.addItem).not.toHaveBeenCalled();
  });

  it('404 when the model rejects the add (not owner or entry not visible)', async () => {
    CollectionModel.addItem.mockResolvedValue(null);
    const res = mockRes();
    await CollectionController.addItem(mockReq({ params: { id: 'c1' }, body: { creature_id: 'e1' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('201 on success', async () => {
    CollectionModel.addItem.mockResolvedValue({ id: 'link1' });
    const res = mockRes();
    await CollectionController.addItem(mockReq({ params: { id: 'c1' }, body: { creature_id: 'e1' } }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ item: { id: 'link1' } });
  });

  it('removeItem 404 when the link does not exist', async () => {
    CollectionModel.removeItem.mockResolvedValue(false);
    const res = mockRes();
    await CollectionController.removeItem(mockReq({ params: { id: 'c1', entryId: 'e1' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('removeItem 200 on success', async () => {
    CollectionModel.removeItem.mockResolvedValue(true);
    const res = mockRes();
    await CollectionController.removeItem(mockReq({ params: { id: 'c1', entryId: 'e1' } }), res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});

describe('CollectionController.import', () => {
  const ATTRS = { dexterity: 3, body: 4, intelligence: 2, wisdom: 5, charisma: 1 };
  const exported = { name: 'Табір', description: 'опис', is_public: true, items: [{ id: 'old', name: 'Один', ...ATTRS }, { id: 'old2', name: 'Два', ...ATTRS }] };

  beforeEach(() => {
    CollectionModel.findAll.mockResolvedValue([]);
    CreatureModel.findAll.mockResolvedValue([]);
  });

  it('400 without a collection name', async () => {
    const res = mockRes();
    await CollectionController.import(mockReq({ body: { items: [] } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(CollectionModel.create).not.toHaveBeenCalled();
  });

  it('400 and nothing created when a nested record is invalid', async () => {
    const res = mockRes();
    await CollectionController.import(mockReq({ body: { name: 'К', items: [{ name: 'Без атрибутів' }] } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(CollectionModel.create).not.toHaveBeenCalled();
  });

  it('creates a new collection with its nested records when nothing matches', async () => {
    CollectionModel.create.mockResolvedValue({ id: 'c-new' });
    CreatureModel.create.mockResolvedValueOnce({ id: 'r1' }).mockResolvedValueOnce({ id: 'r2' });
    const res = mockRes();

    await CollectionController.import(mockReq({ body: exported }), res);

    expect(CreatureModel.create).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'u1', name: 'Один' }));
    expect(CreatureModel.create).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'u1', name: 'Два' }));
    expect(CollectionModel.update).not.toHaveBeenCalled();
    expect(CollectionModel.replaceItems).toHaveBeenCalledWith('c-new', ['r1', 'r2']);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      collections: [{ id: 'c-new' }], imported_items: 2, created_items: 2, updated_items: 0,
      items_skipped: 0, created_collections: 1, updated_collections: 0,
    });
  });

  it('imports only the shell for a regular user and reports skipped items', async () => {
    CollectionModel.create.mockResolvedValue({ id: 'c-new' });
    const res = mockRes();

    await CollectionController.import(mockReq({ body: [exported], user: { sub: 'p1', role: 'user' } }), res);

    expect(CreatureModel.create).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      collections: [{ id: 'c-new' }], imported_items: 0, created_items: 0, updated_items: 0,
      items_skipped: 2, created_collections: 1, updated_collections: 0,
    });
  });

  it('discards the new collection and rethrows when importing records fails', async () => {
    CollectionModel.create.mockResolvedValue({ id: 'c-new' });
    const err = new Error('db down');
    CreatureModel.create.mockRejectedValue(err);

    await expect(CollectionController.import(mockReq({ body: exported }), mockRes())).rejects.toBe(err);
    expect(CollectionModel.discard).toHaveBeenCalledWith('c-new');
  });

  it('updates a matching collection in place instead of creating a duplicate', async () => {
    const existingColl = { id: 'c1', created_by: 'u1', name: 'Табір' };
    CollectionModel.findAll.mockResolvedValue([existingColl]);
    CollectionModel.update.mockResolvedValue(existingColl);
    CreatureModel.create.mockResolvedValueOnce({ id: 'r1' }).mockResolvedValueOnce({ id: 'r2' });
    const res = mockRes();

    await CollectionController.import(mockReq({ body: exported }), res);

    expect(CollectionModel.update).toHaveBeenCalledWith('c1', 'u1', expect.objectContaining({ name: 'Табір' }), false);
    expect(CollectionModel.create).not.toHaveBeenCalled();
    expect(CollectionModel.replaceItems).toHaveBeenCalledWith('c1', ['r1', 'r2']);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ created_collections: 0, updated_collections: 1 }));
  });

  it('updates a matching creature inside the collection instead of creating a duplicate', async () => {
    const existingCreature = { id: 'old', created_by: 'u1', name: 'Один' };
    CollectionModel.create.mockResolvedValue({ id: 'c-new' });
    CreatureModel.findAll.mockResolvedValue([existingCreature]);
    CreatureModel.update.mockResolvedValue(existingCreature);
    CreatureModel.create.mockResolvedValue({ id: 'r2' });
    const res = mockRes();

    await CollectionController.import(mockReq({ body: exported }), res);

    expect(CreatureModel.update).toHaveBeenCalledWith('old', expect.objectContaining({ name: 'Один' }));
    expect(CollectionModel.replaceItems).toHaveBeenCalledWith('c-new', ['old', 'r2']);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ created_items: 1, updated_items: 1 }));
  });
});
