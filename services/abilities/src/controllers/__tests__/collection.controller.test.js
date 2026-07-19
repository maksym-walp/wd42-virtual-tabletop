jest.mock('../../models/collection.model');

const CollectionModel = require('../../models/collection.model');
const CollectionController = require('../collection.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ params = {}, query = {}, body = {}, user = { sub: 'user-1' } } = {}) {
  return { params, query, body, user };
}

beforeEach(() => jest.clearAllMocks());

describe('CollectionController.list', () => {
  it('scopes the lookup to the current user and forwards query filters', async () => {
    CollectionModel.findAll.mockResolvedValue([{ id: 'c1' }]);
    const req = mockReq({ query: { search: 'бойові', scope: 'canonical' } });
    const res = mockRes();

    await CollectionController.list(req, res);

    expect(CollectionModel.findAll).toHaveBeenCalledWith('user-1', { search: 'бойові', scope: 'canonical' });
    expect(res.json).toHaveBeenCalledWith({ collections: [{ id: 'c1' }] });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('db down');
    CollectionModel.findAll.mockRejectedValue(err);
    const req = mockReq();
    const res = mockRes();

    await expect(CollectionController.list(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.getOne', () => {
  it('returns 404 when the collection is not found or not visible to the user', async () => {
    CollectionModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await CollectionController.getOne(req, res);

    expect(CollectionModel.findById).toHaveBeenCalledWith('missing', 'user-1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено' });
  });

  it('returns 200 with the collection on success', async () => {
    CollectionModel.findById.mockResolvedValue({ id: 'c1', name: 'Набір' });
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CollectionController.getOne(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Набір' } });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('boom');
    CollectionModel.findById.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await expect(CollectionController.getOne(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.getPublic', () => {
  it('looks up by id only, without any authenticated user on the request', async () => {
    CollectionModel.findPublicById.mockResolvedValue({ id: 'c1', is_public: true });
    const req = { params: { id: 'c1' } }; // no req.user — unauthenticated route
    const res = mockRes();

    await CollectionController.getPublic(req, res);

    expect(CollectionModel.findPublicById).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', is_public: true } });
  });

  it('returns 404 when the collection is missing or not public', async () => {
    CollectionModel.findPublicById.mockResolvedValue(null);
    const req = { params: { id: 'private-1' } };
    const res = mockRes();

    await CollectionController.getPublic(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено або вона приватна' });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('boom');
    CollectionModel.findPublicById.mockRejectedValue(err);
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await expect(CollectionController.getPublic(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.create', () => {
  it('returns 400 when name is missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await CollectionController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "name є обовʼязковим" });
    expect(CollectionModel.create).not.toHaveBeenCalled();
  });

  it('creates a collection when name is present', async () => {
    CollectionModel.create.mockResolvedValue({ id: 'c2', name: 'Набір' });
    const req = mockReq({ body: { name: 'Набір' } });
    const res = mockRes();

    await CollectionController.create(req, res);

    expect(CollectionModel.create).toHaveBeenCalledWith('user-1', { name: 'Набір' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c2', name: 'Набір' } });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('boom');
    CollectionModel.create.mockRejectedValue(err);
    const req = mockReq({ body: { name: 'Набір' } });
    const res = mockRes();

    await expect(CollectionController.create(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.update', () => {
  it('returns 404 when the collection is not found or not owned by the user', async () => {
    CollectionModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Нове' } });
    const res = mockRes();

    await CollectionController.update(req, res);

    expect(CollectionModel.update).toHaveBeenCalledWith('c1', 'user-1', { name: 'Нове' });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено або недостатньо прав' });
  });

  it('returns 200 with the updated collection on success', async () => {
    CollectionModel.update.mockResolvedValue({ id: 'c1', name: 'Нове' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Нове' } });
    const res = mockRes();

    await CollectionController.update(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Нове' } });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('boom');
    CollectionModel.update.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' }, body: {} });
    const res = mockRes();

    await expect(CollectionController.update(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.remove', () => {
  it('returns 404 when nothing was deleted (not found or not owned)', async () => {
    CollectionModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CollectionController.remove(req, res);

    expect(CollectionModel.delete).toHaveBeenCalledWith('c1', 'user-1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено або недостатньо прав' });
  });

  it('returns 200 with a confirmation message on success', async () => {
    CollectionModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CollectionController.remove(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('boom');
    CollectionModel.delete.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await expect(CollectionController.remove(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.addItem', () => {
  it('returns 400 when ability_id is missing', async () => {
    const req = mockReq({ params: { id: 'c1' }, body: {} });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'ability_id є обовʼязковим' });
    expect(CollectionModel.addItem).not.toHaveBeenCalled();
  });

  it('returns 404 when the collection or ability is not found', async () => {
    CollectionModel.addItem.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { ability_id: 'a1' } });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(CollectionModel.addItem).toHaveBeenCalledWith('c1', 'user-1', 'a1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію або вміння не знайдено' });
  });

  it('returns 404 when the collection was found but the ability was not (add returns null)', async () => {
    // Mirrors CollectionModel.addItem: owns the collection, but the ability
    // isn't visible to the user, so the model resolves null rather than throwing.
    CollectionModel.addItem.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'owned-collection' }, body: { ability_id: 'invisible-ability' } });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію або вміння не знайдено' });
  });

  it('returns 201 with the added item on success', async () => {
    CollectionModel.addItem.mockResolvedValue({ collection_id: 'c1', ability_id: 'a1' });
    const req = mockReq({ params: { id: 'c1' }, body: { ability_id: 'a1' } });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ item: { collection_id: 'c1', ability_id: 'a1' } });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('boom');
    CollectionModel.addItem.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' }, body: { ability_id: 'a1' } });
    const res = mockRes();

    await expect(CollectionController.addItem(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.removeItem', () => {
  it('returns 404 when nothing was removed (collection, ownership, or item not found)', async () => {
    CollectionModel.removeItem.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', itemId: 'a1' } });
    const res = mockRes();

    await CollectionController.removeItem(req, res);

    expect(CollectionModel.removeItem).toHaveBeenCalledWith('c1', 'user-1', 'a1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Не знайдено' });
  });

  it('returns 200 with a confirmation message on success', async () => {
    CollectionModel.removeItem.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', itemId: 'a1' } });
    const res = mockRes();

    await CollectionController.removeItem(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('boom');
    CollectionModel.removeItem.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1', itemId: 'a1' } });
    const res = mockRes();

    await expect(CollectionController.removeItem(req, res)).rejects.toBe(err);
  });
});
