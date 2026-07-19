jest.mock('../../models/item.model');

const ItemModel = require('../../models/item.model');
const ItemController = require('../item.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ body = {}, params = {}, query = {}, user = { sub: 'user-1' } } = {}) {
  return { body, params, query, user };
}

beforeEach(() => jest.clearAllMocks());

describe('ItemController.list', () => {
  it('passes query filters through to the model and returns items', async () => {
    ItemModel.findAll.mockResolvedValue([{ id: 'i1' }]);
    const req = mockReq({
      query: { type: 'weapon', weapon_type: 'sword', armor_weight: 'light', search: 'axe', sort: 'name', dir: 'desc', scope: 'user' },
    });
    const res = mockRes();

    await ItemController.list(req, res);

    expect(ItemModel.findAll).toHaveBeenCalledWith('user-1', {
      type: 'weapon', weaponType: 'sword', armorWeight: 'light',
      search: 'axe', sort: 'name', dir: 'desc', scope: 'user',
    });
    expect(res.json).toHaveBeenCalledWith({ items: [{ id: 'i1' }] });
  });
});

describe('ItemController.getOne', () => {
  it('returns 404 when the item is not found or not visible', async () => {
    ItemModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await ItemController.getOne(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Предмет не знайдено' });
  });

  it('returns 200 with the item on success', async () => {
    ItemModel.findById.mockResolvedValue({ id: 'i1', name: 'Sword' });
    const req = mockReq({ params: { id: 'i1' } });
    const res = mockRes();

    await ItemController.getOne(req, res);

    expect(res.json).toHaveBeenCalledWith({ item: { id: 'i1', name: 'Sword' } });
  });
});

describe('ItemController.create', () => {
  it('returns 400 when name is missing', async () => {
    const req = mockReq({ body: { type: 'weapon' } });
    const res = mockRes();

    await ItemController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'name є обовʼязковим' });
    expect(ItemModel.create).not.toHaveBeenCalled();
  });

  it('rethrows unexpected model errors instead of mapping them', async () => {
    const err = new Error('db exploded');
    ItemModel.create.mockRejectedValue(err);
    const req = mockReq({ body: { name: 'Sword' } });
    const res = mockRes();

    await expect(ItemController.create(req, res)).rejects.toBe(err);
  });

  it('returns 201 with the created item on success', async () => {
    ItemModel.create.mockResolvedValue({ id: 'i1', name: 'Sword' });
    const req = mockReq({ body: { name: 'Sword' } });
    const res = mockRes();

    await ItemController.create(req, res);

    expect(ItemModel.create).toHaveBeenCalledWith('user-1', { name: 'Sword' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ item: { id: 'i1', name: 'Sword' } });
  });
});

describe('ItemController.update', () => {
  it('returns 404 when the item is not found or not owned', async () => {
    ItemModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'i1' }, body: { name: 'Sword' } });
    const res = mockRes();

    await ItemController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Предмет не знайдено або недостатньо прав' });
  });

  it('rethrows unexpected model errors instead of mapping them', async () => {
    const err = new Error('db exploded');
    ItemModel.update.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'i1' }, body: { name: 'Sword' } });
    const res = mockRes();

    await expect(ItemController.update(req, res)).rejects.toBe(err);
  });

  it('returns 200 with the updated item on success', async () => {
    ItemModel.update.mockResolvedValue({ id: 'i1', name: 'Great Sword' });
    const req = mockReq({ params: { id: 'i1' }, body: { name: 'Great Sword' } });
    const res = mockRes();

    await ItemController.update(req, res);

    expect(ItemModel.update).toHaveBeenCalledWith('i1', 'user-1', { name: 'Great Sword' });
    expect(res.json).toHaveBeenCalledWith({ item: { id: 'i1', name: 'Great Sword' } });
  });
});

describe('ItemController.remove', () => {
  it('returns 404 when the item is not found or not owned', async () => {
    ItemModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'i1' } });
    const res = mockRes();

    await ItemController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Предмет не знайдено або недостатньо прав' });
  });

  it('rethrows unexpected model errors instead of mapping them', async () => {
    const err = new Error('db exploded');
    ItemModel.delete.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'i1' } });
    const res = mockRes();

    await expect(ItemController.remove(req, res)).rejects.toBe(err);
  });

  it('returns 200 on success', async () => {
    ItemModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'i1' } });
    const res = mockRes();

    await ItemController.remove(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
