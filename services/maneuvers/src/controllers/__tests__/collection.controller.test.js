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
  it('passes search/scope query params through to the model and returns collections', async () => {
    CollectionModel.findAll.mockResolvedValue([{ id: 'c1' }]);
    const req = mockReq({ query: { search: 'бойові', scope: 'canonical' } });
    const res = mockRes();

    await CollectionController.list(req, res);

    expect(CollectionModel.findAll).toHaveBeenCalledWith('user-1', { search: 'бойові', scope: 'canonical' });
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
    CollectionModel.findById.mockResolvedValue({ id: 'c1', name: 'Набір' });
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CollectionController.getOne(req, res);

    expect(CollectionModel.findById).toHaveBeenCalledWith('c1', 'user-1');
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Набір' } });
  });
});

describe('CollectionController.getPublic', () => {
  it('works without req.user and returns 404 when not found or private', async () => {
    CollectionModel.findPublicById.mockResolvedValue(null);
    const req = { params: { id: 'c1' }, body: {}, query: {} };
    const res = mockRes();

    await CollectionController.getPublic(req, res);

    expect(CollectionModel.findPublicById).toHaveBeenCalledWith('c1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено або вона приватна' });
  });

  it('returns 200 with the public collection on success, without requiring req.user', async () => {
    CollectionModel.findPublicById.mockResolvedValue({ id: 'c1', name: 'Публічна', is_owner: false });
    const req = { params: { id: 'c1' }, body: {}, query: {} };
    const res = mockRes();

    await CollectionController.getPublic(req, res);

    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Публічна', is_owner: false } });
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

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    CollectionModel.create.mockRejectedValue(err);
    const req = mockReq({ body: { name: 'Набір' } });
    const res = mockRes();

    await expect(CollectionController.create(req, res)).rejects.toBe(err);
  });

  it('returns 201 with the created collection on success', async () => {
    CollectionModel.create.mockResolvedValue({ id: 'c1', name: 'Набір' });
    const req = mockReq({ body: { name: 'Набір' } });
    const res = mockRes();

    await CollectionController.create(req, res);

    expect(CollectionModel.create).toHaveBeenCalledWith('user-1', { name: 'Набір' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Набір' } });
  });
});

describe('CollectionController.update', () => {
  it('returns 404 when the collection is not found or not owned', async () => {
    CollectionModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Нова назва' } });
    const res = mockRes();

    await CollectionController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію не знайдено або недостатньо прав' });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    CollectionModel.update.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Нова назва' } });
    const res = mockRes();

    await expect(CollectionController.update(req, res)).rejects.toBe(err);
  });

  it('returns 200 with the updated collection on success', async () => {
    CollectionModel.update.mockResolvedValue({ id: 'c1', name: 'Нова назва' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'Нова назва' } });
    const res = mockRes();

    await CollectionController.update(req, res);

    expect(CollectionModel.update).toHaveBeenCalledWith('c1', 'user-1', { name: 'Нова назва' });
    expect(res.json).toHaveBeenCalledWith({ collection: { id: 'c1', name: 'Нова назва' } });
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

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    CollectionModel.delete.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await expect(CollectionController.remove(req, res)).rejects.toBe(err);
  });

  it('returns 200 with a confirmation message on success', async () => {
    CollectionModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CollectionController.remove(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});

describe('CollectionController.addItem', () => {
  it('returns 400 when maneuver_id is missing', async () => {
    const req = mockReq({ params: { id: 'c1' }, body: {} });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'maneuver_id є обовʼязковим' });
    expect(CollectionModel.addItem).not.toHaveBeenCalled();
  });

  it('returns 404 when the collection or maneuver is not found', async () => {
    CollectionModel.addItem.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { maneuver_id: 'm1' } });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Колекцію або маневр не знайдено' });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    CollectionModel.addItem.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1' }, body: { maneuver_id: 'm1' } });
    const res = mockRes();

    await expect(CollectionController.addItem(req, res)).rejects.toBe(err);
  });

  it('returns 201 with the added item on success', async () => {
    CollectionModel.addItem.mockResolvedValue({ collection_id: 'c1', maneuver_id: 'm1' });
    const req = mockReq({ params: { id: 'c1' }, body: { maneuver_id: 'm1' } });
    const res = mockRes();

    await CollectionController.addItem(req, res);

    expect(CollectionModel.addItem).toHaveBeenCalledWith('c1', 'user-1', 'm1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ item: { collection_id: 'c1', maneuver_id: 'm1' } });
  });
});

describe('CollectionController.removeItem', () => {
  it('returns 404 when the collection item is not found', async () => {
    CollectionModel.removeItem.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', itemId: 'm1' } });
    const res = mockRes();

    await CollectionController.removeItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Не знайдено' });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    CollectionModel.removeItem.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'c1', itemId: 'm1' } });
    const res = mockRes();

    await expect(CollectionController.removeItem(req, res)).rejects.toBe(err);
  });

  it('returns 200 with a confirmation message on success', async () => {
    CollectionModel.removeItem.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', itemId: 'm1' } });
    const res = mockRes();

    await CollectionController.removeItem(req, res);

    expect(CollectionModel.removeItem).toHaveBeenCalledWith('c1', 'user-1', 'm1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
