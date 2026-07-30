jest.mock('../../models/collection.model');

const CollectionModel = require('../../models/collection.model');
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
  it('400 when entry_id missing', async () => {
    const res = mockRes();
    await CollectionController.addItem(mockReq({ params: { id: 'c1' }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(CollectionModel.addItem).not.toHaveBeenCalled();
  });

  it('404 when the model rejects the add (not owner or entry not visible)', async () => {
    CollectionModel.addItem.mockResolvedValue(null);
    const res = mockRes();
    await CollectionController.addItem(mockReq({ params: { id: 'c1' }, body: { entry_id: 'e1' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('201 on success', async () => {
    CollectionModel.addItem.mockResolvedValue({ id: 'link1' });
    const res = mockRes();
    await CollectionController.addItem(mockReq({ params: { id: 'c1' }, body: { entry_id: 'e1' } }), res);
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
