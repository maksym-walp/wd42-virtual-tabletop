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
    const req = mockReq({ query: { search: 'fire', scope: 'user' } });
    const res = mockRes();

    await CollectionController.list(req, res);

    expect(CollectionModel.findAll).toHaveBeenCalledWith('user-1', { search: 'fire', scope: 'user' });
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

    expect(CollectionModel.findById).toHaveBeenCalledWith('c1', 'user-1');
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

    expect(CollectionModel.create).toHaveBeenCalledWith('user-1', { name: 'Fire spells' });
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

    expect(CollectionModel.addItem).toHaveBeenCalledWith('c1', 'user-1', 's1');
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

    expect(CollectionModel.removeItem).toHaveBeenCalledWith('c1', 'user-1', 's1');
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
