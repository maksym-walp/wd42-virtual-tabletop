jest.mock('../../models/collection.model');
jest.mock('../../models/spell.model');

const CollectionModel = require('../../models/collection.model');
const SpellModel = require('../../models/spell.model');
const CollectionController = require('../collection.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ body = {}, params = {}, query = {}, user = { sub: 'user-1' } } = {}) {
  return { body, params, query, user };
}

beforeEach(() => jest.clearAllMocks());

describe('CollectionController.list', () => {
  it('passes query filters through to the model and returns collections', async () => {
    CollectionModel.findAll.mockResolvedValue([{ id: 'c1' }]);
    const req = mockReq({ query: { search: 'fire', scope: 'user' } });
    const res = mockRes();

    await CollectionController.list(req, res);

    expect(CollectionModel.findAll).toHaveBeenCalledWith('user-1', { search: 'fire', scope: 'user' }, false);
    expect(res.json).toHaveBeenCalledWith({ collections: [{ id: 'c1' }] });
  });

  it('rethrows unexpected model errors', async () => {
    const err = new Error('boom');
    CollectionModel.findAll.mockRejectedValue(err);
    const req = mockReq();
    const res = mockRes();
    await expect(CollectionController.list(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.getOne', () => {
  it('returns 404 when the collection is not found', async () => {
    CollectionModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CollectionController.getOne(req, res);

    expect(CollectionModel.findById).toHaveBeenCalledWith('c1', 'user-1', false);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено' });
  });

  it('returns 200 with the collection on success', async () => {
    CollectionModel.findById.mockResolvedValue({ id: 'c1', name: 'Fire spells' });
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CollectionController.getOne(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Fire spells' } });
  });

  it('rethrows unexpected model errors', async () => {
    const err = new Error('boom');
    CollectionModel.findById.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();
    await expect(CollectionController.getOne(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.getPublic', () => {
  it('is unauthenticated and does not read req.user', async () => {
    CollectionModel.findPublicById.mockResolvedValue({ id: 'c1', name: 'Public' });
    const req = { params: { id: 'c1' } }; // no req.user
    const res = mockRes();

    await CollectionController.getPublic(req, res);

    expect(CollectionModel.findPublicById).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Public' } });
  });

  it('returns 404 when the collection is not found or not public', async () => {
    CollectionModel.findPublicById.mockResolvedValue(null);
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await CollectionController.getPublic(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено або вона приватна' });
  });

  it('rethrows unexpected model errors', async () => {
    const err = new Error('boom');
    CollectionModel.findPublicById.mockRejectedValue(err);
    const req = { params: { id: 'c1' } };
    const res = mockRes();
    await expect(CollectionController.getPublic(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.create', () => {
  it('returns 400 when name is missing', async () => {
    const req = mockReq({ body: { description: 'no name' } });
    const res = mockRes();

    await CollectionController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'name є обовʼязковим' });
    expect(CollectionModel.create).not.toHaveBeenCalled();
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    CollectionModel.create.mockRejectedValue(err);
    const req = mockReq({ body: { name: 'Fire spells' } });
    const res = mockRes();
    await expect(CollectionController.create(req, res)).rejects.toBe(err);
  });

  it('returns 201 with the created collection on success', async () => {
    CollectionModel.create.mockResolvedValue({ id: 'c1', name: 'Fire spells' });
    const req = mockReq({ body: { name: 'Fire spells' } });
    const res = mockRes();

    await CollectionController.create(req, res);

    expect(CollectionModel.create).toHaveBeenCalledWith('user-1', { name: 'Fire spells', is_canonical: false });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Fire spells' } });
  });
});

describe('CollectionController.update', () => {
  it('returns 404 when the collection is not found or not owned', async () => {
    CollectionModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Renamed' } });
    const res = mockRes();

    await CollectionController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено або недостатньо прав' });
  });

  it('rethrows unexpected model errors', async () => {
    const err = new Error('boom');
    CollectionModel.update.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Renamed' } });
    const res = mockRes();
    await expect(CollectionController.update(req, res)).rejects.toBe(err);
  });

  it('returns 200 with the updated collection on success', async () => {
    CollectionModel.update.mockResolvedValue({ id: 'c1', name: 'Renamed' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Renamed' } });
    const res = mockRes();

    await CollectionController.update(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Renamed' } });
  });
});

describe('CollectionController.remove', () => {
  it('returns 404 when the collection is not found or not owned', async () => {
    CollectionModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CollectionController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено або недостатньо прав' });
  });

  it('rethrows unexpected model errors', async () => {
    const err = new Error('boom');
    CollectionModel.delete.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();
    await expect(CollectionController.remove(req, res)).rejects.toBe(err);
  });

  it('returns 200 on success', async () => {
    CollectionModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CollectionController.remove(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});

describe('CollectionController.addItem', () => {
  it('returns 400 when spell_id is missing', async () => {
    const req = mockReq({ params: { id: 'c1' }, body: {} });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'spell_id є обовʼязковим' });
    expect(CollectionModel.addItem).not.toHaveBeenCalled();
  });

  it('returns 404 when the collection or spell is not found', async () => {
    CollectionModel.addItem.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { spell_id: 's1' } });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(CollectionModel.addItem).toHaveBeenCalledWith('c1', 'user-1', 's1', false);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію або заклинання не знайдено' });
  });

  it('rethrows unexpected model errors', async () => {
    const err = new Error('boom');
    CollectionModel.addItem.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' }, body: { spell_id: 's1' } });
    const res = mockRes();
    await expect(CollectionController.addItem(req, res)).rejects.toBe(err);
  });

  it('returns 201 with the added item on success', async () => {
    CollectionModel.addItem.mockResolvedValue({ collection_id: 'c1', spell_id: 's1' });
    const req = mockReq({ params: { id: 'c1' }, body: { spell_id: 's1' } });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ item: { collection_id: 'c1', spell_id: 's1' } });
  });
});

describe('CollectionController.removeItem', () => {
  it('returns 404 when nothing was removed', async () => {
    CollectionModel.removeItem.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', itemId: 's1' } });
    const res = mockRes();

    await CollectionController.removeItem(req, res);

    expect(CollectionModel.removeItem).toHaveBeenCalledWith('c1', 'user-1', 's1', false);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Не знайдено' });
  });

  it('rethrows unexpected model errors', async () => {
    const err = new Error('boom');
    CollectionModel.removeItem.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1', itemId: 's1' } });
    const res = mockRes();
    await expect(CollectionController.removeItem(req, res)).rejects.toBe(err);
  });

  it('returns 200 on success', async () => {
    CollectionModel.removeItem.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', itemId: 's1' } });
    const res = mockRes();

    await CollectionController.removeItem(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});

describe('CollectionController.import', () => {
  const exported = {
    name: 'Набір бійця', description: 'опис', is_public: true,
    items: [{ id: 'old-1', name: 'Удар' }, { id: 'old-2', name: 'Ривок' }],
  };
  const GM = { sub: 'gm-1', role: 'game_master' };

  beforeEach(() => {
    CollectionModel.findAll.mockResolvedValue([]);
    SpellModel.findAll.mockResolvedValue([]);
  });

  it('rejects a payload without a collection name', async () => {
    const res = mockRes();
    await CollectionController.import(mockReq({ body: { items: [] } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(CollectionModel.create).not.toHaveBeenCalled();
  });

  it('rejects nested items without a name before touching the database', async () => {
    const res = mockRes();
    await CollectionController.import(mockReq({ body: { name: 'К', items: [{ mechanical_desc: 'x' }] }, user: GM }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(CollectionModel.create).not.toHaveBeenCalled();
  });

  it('creates a new collection with its nested items as canonical when nothing matches', async () => {
    CollectionModel.create.mockResolvedValue({ id: 'c-new' });
    SpellModel.create.mockResolvedValueOnce({ id: 's1' }).mockResolvedValueOnce({ id: 's2' });
    const res = mockRes();

    await CollectionController.import(mockReq({ body: exported, user: GM }), res);

    expect(SpellModel.create).toHaveBeenCalledWith('gm-1', expect.objectContaining({ name: 'Удар', is_canonical: true }));
    expect(SpellModel.create).toHaveBeenCalledWith('gm-1', expect.objectContaining({ name: 'Ривок', is_canonical: true }));
    expect(CollectionModel.update).not.toHaveBeenCalled();
    expect(CollectionModel.replaceItems).toHaveBeenCalledWith('c-new', ['s1', 's2']);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      collections: [{ id: 'c-new' }], imported_items: 2, created_items: 2, updated_items: 0,
      items_skipped: 0, created_collections: 1, updated_collections: 0,
    });
  });

  it('imports only the collection shell for a regular user and reports skipped items', async () => {
    CollectionModel.create.mockResolvedValue({ id: 'c-new' });
    const res = mockRes();

    await CollectionController.import(mockReq({ body: [exported], user: { sub: 'user-1', role: 'user' } }), res);

    expect(SpellModel.create).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      collections: [{ id: 'c-new' }], imported_items: 0, created_items: 0, updated_items: 0,
      items_skipped: 2, created_collections: 1, updated_collections: 0,
    });
  });

  it('discards the new collection and rethrows when importing the items fails', async () => {
    CollectionModel.create.mockResolvedValue({ id: 'c-new' });
    const err = new Error('db down');
    SpellModel.create.mockRejectedValue(err);

    await expect(
      CollectionController.import(mockReq({ body: exported, user: GM }), mockRes())
    ).rejects.toBe(err);
    expect(CollectionModel.discard).toHaveBeenCalledWith('c-new');
  });

  it('updates a matching collection in place instead of creating a duplicate', async () => {
    const existingColl = { id: 'c1', user_id: 'gm-1', name: 'Набір бійця' };
    CollectionModel.findAll.mockResolvedValue([existingColl]);
    CollectionModel.update.mockResolvedValue(existingColl);
    SpellModel.create.mockResolvedValueOnce({ id: 's1' }).mockResolvedValueOnce({ id: 's2' });
    const res = mockRes();

    await CollectionController.import(mockReq({ body: exported, user: GM }), res);

    expect(CollectionModel.update).toHaveBeenCalledWith('c1', 'gm-1', expect.objectContaining({ name: 'Набір бійця' }), false);
    expect(CollectionModel.create).not.toHaveBeenCalled();
    expect(CollectionModel.replaceItems).toHaveBeenCalledWith('c1', ['s1', 's2']);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ created_collections: 0, updated_collections: 1 }));
  });

  it('updates a matching spell inside the collection instead of creating a duplicate', async () => {
    const existingSpell = { id: 'old-1', user_id: 'gm-1', name: 'Удар' };
    CollectionModel.create.mockResolvedValue({ id: 'c-new' });
    SpellModel.findAll.mockResolvedValue([existingSpell]);
    SpellModel.update.mockResolvedValue(existingSpell);
    SpellModel.create.mockResolvedValue({ id: 's2' });
    const res = mockRes();

    await CollectionController.import(mockReq({ body: exported, user: GM }), res);

    expect(SpellModel.update).toHaveBeenCalledWith('old-1', 'gm-1', expect.objectContaining({ name: 'Удар' }), false);
    expect(CollectionModel.replaceItems).toHaveBeenCalledWith('c-new', ['old-1', 's2']);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ created_items: 1, updated_items: 1 }));
  });
});
