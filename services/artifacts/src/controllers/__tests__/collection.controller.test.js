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
  it('forwards query filters to the model and returns 200 with the list', async () => {
    CollectionModel.findAll.mockResolvedValue([{ id: 'c1' }]);
    const req = mockReq({ query: { search: 'chest', scope: 'user' } });
    const res = mockRes();

    await CollectionController.list(req, res);

    expect(CollectionModel.findAll).toHaveBeenCalledWith('user-1', { search: 'chest', scope: 'user' });
    expect(res.json).toHaveBeenCalledWith({ collections: [{ id: 'c1' }] });
  });

  it('rethrows unrelated model errors', async () => {
    const err = new Error('db down');
    CollectionModel.findAll.mockRejectedValue(err);
    const req = mockReq();
    const res = mockRes();
    await expect(CollectionController.list(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.getOne', () => {
  it('returns 404 when the collection is not found', async () => {
    CollectionModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await CollectionController.getOne(req, res);

    expect(CollectionModel.findById).toHaveBeenCalledWith('missing', 'user-1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено' });
  });

  it('returns 200 with the collection on success', async () => {
    CollectionModel.findById.mockResolvedValue({ id: 'c1', name: 'Chest' });
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CollectionController.getOne(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Chest' } });
  });

  it('rethrows unrelated model errors', async () => {
    const err = new Error('db down');
    CollectionModel.findById.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();
    await expect(CollectionController.getOne(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.getPublic', () => {
  it('is unauthenticated: works with no req.user', async () => {
    CollectionModel.findPublicById.mockResolvedValue({ id: 'c1', name: 'Public Chest' });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await CollectionController.getPublic(req, res);

    expect(CollectionModel.findPublicById).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Public Chest' } });
  });

  it('returns 404 when the collection is not found or not public', async () => {
    CollectionModel.findPublicById.mockResolvedValue(null);
    const req = { params: { id: 'missing' } };
    const res = mockRes();

    await CollectionController.getPublic(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено або вона приватна' });
  });

  it('rethrows unrelated model errors', async () => {
    const err = new Error('db down');
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
    expect(res.json).toHaveBeenCalledWith({ message: 'name є обовʼязковим' });
    expect(CollectionModel.create).not.toHaveBeenCalled();
  });

  it('creates and returns 201 with the collection on success', async () => {
    CollectionModel.create.mockResolvedValue({ id: 'c1', name: 'Chest' });
    const req = mockReq({ body: { name: 'Chest' } });
    const res = mockRes();

    await CollectionController.create(req, res);

    expect(CollectionModel.create).toHaveBeenCalledWith('user-1', { name: 'Chest' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Chest' } });
  });

  it('rethrows unrelated model errors', async () => {
    const err = new Error('db down');
    CollectionModel.create.mockRejectedValue(err);
    const req = mockReq({ body: { name: 'Chest' } });
    const res = mockRes();
    await expect(CollectionController.create(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.update', () => {
  it('returns 404 when the collection is not found or not owned', async () => {
    CollectionModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'New' } });
    const res = mockRes();

    await CollectionController.update(req, res);

    expect(CollectionModel.update).toHaveBeenCalledWith('c1', 'user-1', { name: 'New' });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено або недостатньо прав' });
  });

  it('returns 200 with the updated collection on success', async () => {
    CollectionModel.update.mockResolvedValue({ id: 'c1', name: 'New' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'New' } });
    const res = mockRes();

    await CollectionController.update(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'New' } });
  });

  it('rethrows unrelated model errors', async () => {
    const err = new Error('db down');
    CollectionModel.update.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'New' } });
    const res = mockRes();
    await expect(CollectionController.update(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.remove', () => {
  it('returns 404 when the collection is not found or not owned', async () => {
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

  it('rethrows unrelated model errors', async () => {
    const err = new Error('db down');
    CollectionModel.delete.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();
    await expect(CollectionController.remove(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.addItem', () => {
  it('returns 400 when artifact_id is missing', async () => {
    const req = mockReq({ params: { id: 'c1' }, body: {} });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'artifact_id є обовʼязковим' });
    expect(CollectionModel.addItem).not.toHaveBeenCalled();
  });

  it('returns 404 when the collection or artifact is not found (model returns null)', async () => {
    CollectionModel.addItem.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { artifact_id: 'a1' } });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(CollectionModel.addItem).toHaveBeenCalledWith('c1', 'user-1', 'a1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію або артефакт не знайдено' });
  });

  it('returns 201 with the added item on success', async () => {
    CollectionModel.addItem.mockResolvedValue({ collection_id: 'c1', artifact_id: 'a1' });
    const req = mockReq({ params: { id: 'c1' }, body: { artifact_id: 'a1' } });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ item: { collection_id: 'c1', artifact_id: 'a1' } });
  });

  it('rethrows unrelated model errors', async () => {
    const err = new Error('db down');
    CollectionModel.addItem.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' }, body: { artifact_id: 'a1' } });
    const res = mockRes();
    await expect(CollectionController.addItem(req, res)).rejects.toBe(err);
  });
});

describe('CollectionController.removeItem', () => {
  it('returns 404 when nothing was removed', async () => {
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

  it('rethrows unrelated model errors', async () => {
    const err = new Error('db down');
    CollectionModel.removeItem.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1', itemId: 'a1' } });
    const res = mockRes();
    await expect(CollectionController.removeItem(req, res)).rejects.toBe(err);
  });
});
