jest.mock('../../models/collection.model');

const CollectionModel = require('../../models/collection.model');
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
    const req = mockReq({ query: { search: 'chest', scope: 'canonical' } });
    const res = mockRes();

    await CollectionController.list(req, res);

    expect(CollectionModel.findAll).toHaveBeenCalledWith('user-1', { search: 'chest', scope: 'canonical' });
    expect(res.json).toHaveBeenCalledWith({ collections: [{ id: 'c1' }] });
  });
});

describe('CollectionController.getOne', () => {
  it('returns 404 when the collection is not found or not visible', async () => {
    CollectionModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await CollectionController.getOne(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено' });
  });

  it('returns 200 with the collection on success', async () => {
    CollectionModel.findById.mockResolvedValue({ id: 'c1', name: 'Chest' });
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CollectionController.getOne(req, res);

    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Chest' } });
  });
});

describe('CollectionController.getPublic', () => {
  it('works without req.user and returns 404 when not found or private', async () => {
    CollectionModel.findPublicById.mockResolvedValue(null);
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await CollectionController.getPublic(req, res);

    expect(CollectionModel.findPublicById).toHaveBeenCalledWith('c1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено або вона приватна' });
  });

  it('returns 200 with the public collection on success, without req.user', async () => {
    CollectionModel.findPublicById.mockResolvedValue({ id: 'c1', name: 'Chest', is_public: true });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await CollectionController.getPublic(req, res);

    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Chest', is_public: true } });
  });
});

describe('CollectionController.create', () => {
  it('returns 400 when name is missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await CollectionController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'name є обовʼязковим' });
    expect(CollectionModel.create).not.toHaveBeenCalled();
  });

  it('rethrows unexpected model errors instead of mapping them', async () => {
    const err = new Error('db exploded');
    CollectionModel.create.mockRejectedValue(err);
    const req = mockReq({ body: { name: 'Chest' } });
    const res = mockRes();

    await expect(CollectionController.create(req, res)).rejects.toBe(err);
  });

  it('returns 201 with the created collection on success', async () => {
    CollectionModel.create.mockResolvedValue({ id: 'c1', name: 'Chest' });
    const req = mockReq({ body: { name: 'Chest' } });
    const res = mockRes();

    await CollectionController.create(req, res);

    expect(CollectionModel.create).toHaveBeenCalledWith('user-1', { name: 'Chest' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Chest' } });
  });
});

describe('CollectionController.update', () => {
  it('returns 404 when the collection is not found or not owned', async () => {
    CollectionModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Chest' } });
    const res = mockRes();

    await CollectionController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено або недостатньо прав' });
  });

  it('rethrows unexpected model errors instead of mapping them', async () => {
    const err = new Error('db exploded');
    CollectionModel.update.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Chest' } });
    const res = mockRes();

    await expect(CollectionController.update(req, res)).rejects.toBe(err);
  });

  it('returns 200 with the updated collection on success', async () => {
    CollectionModel.update.mockResolvedValue({ id: 'c1', name: 'Big Chest' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Big Chest' } });
    const res = mockRes();

    await CollectionController.update(req, res);

    expect(CollectionModel.update).toHaveBeenCalledWith('c1', 'user-1', { name: 'Big Chest' });
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Big Chest' } });
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

  it('rethrows unexpected model errors instead of mapping them', async () => {
    const err = new Error('db exploded');
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

    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});

describe('CollectionController.addItem', () => {
  it('returns 400 when item_id is missing', async () => {
    const req = mockReq({ params: { id: 'c1' }, body: {} });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'item_id є обовʼязковим' });
    expect(CollectionModel.addItem).not.toHaveBeenCalled();
  });

  it('returns 404 when the collection or item is not found', async () => {
    CollectionModel.addItem.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { item_id: 'i1' } });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію або предмет не знайдено' });
  });

  it('rethrows unexpected model errors instead of mapping them', async () => {
    const err = new Error('db exploded');
    CollectionModel.addItem.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' }, body: { item_id: 'i1' } });
    const res = mockRes();

    await expect(CollectionController.addItem(req, res)).rejects.toBe(err);
  });

  it('returns 201 with the added item on success', async () => {
    CollectionModel.addItem.mockResolvedValue({ collection_id: 'c1', item_id: 'i1' });
    const req = mockReq({ params: { id: 'c1' }, body: { item_id: 'i1' } });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(CollectionModel.addItem).toHaveBeenCalledWith('c1', 'user-1', 'i1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ item: { collection_id: 'c1', item_id: 'i1' } });
  });
});

describe('CollectionController.removeItem', () => {
  it('returns 404 when the collection/item link is not found', async () => {
    CollectionModel.removeItem.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', itemId: 'i1' } });
    const res = mockRes();

    await CollectionController.removeItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Не знайдено' });
  });

  it('rethrows unexpected model errors instead of mapping them', async () => {
    const err = new Error('db exploded');
    CollectionModel.removeItem.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1', itemId: 'i1' } });
    const res = mockRes();

    await expect(CollectionController.removeItem(req, res)).rejects.toBe(err);
  });

  it('returns 200 on success', async () => {
    CollectionModel.removeItem.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', itemId: 'i1' } });
    const res = mockRes();

    await CollectionController.removeItem(req, res);

    expect(CollectionModel.removeItem).toHaveBeenCalledWith('c1', 'user-1', 'i1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
