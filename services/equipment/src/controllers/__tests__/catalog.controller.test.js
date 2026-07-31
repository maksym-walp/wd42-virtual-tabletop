jest.mock('../../models/catalog.model', () => {
  const model = {
    kind: 'weapon',
    label: 'Зброю',
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    setCanonical: jest.fn(),
  };
  return {
    __model: model,
    createCatalogModel: jest.fn(() => model),
    UnionModel: { findAll: jest.fn(), findById: jest.fn() },
  };
});

const { __model: Model, createCatalogModel, UnionModel } = require('../../models/catalog.model');
const { createCatalogController, UnionController } = require('../catalog.controller');

const controller = createCatalogController('weapon');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ body = {}, params = {}, query = {}, user = { sub: 'user-1' } } = {}) {
  return { body, params, query, user };
}

beforeEach(() => jest.clearAllMocks());

describe('createCatalogController', () => {
  it('binds each controller to the model of its own kind', () => {
    createCatalogModel.mockClear();
    createCatalogController('armor');
    expect(createCatalogModel).toHaveBeenCalledWith('armor');
  });

  // Повідомлення мають називати вид, а не абстрактне «спорядження» —
  // користувач бачить його в конкретній формі.
  it('names the kind in its not-found messages', async () => {
    Model.findById.mockResolvedValue(null);
    const res = mockRes();

    await controller.getOne(mockReq({ params: { id: 'missing' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Зброю не знайдено' });
  });
});

describe('list', () => {
  it('passes the whole query through, so each kind can read its own filters', async () => {
    Model.findAll.mockResolvedValue([{ id: 'w1' }]);
    const req = mockReq({ query: { weapon_type: 'melee', sort: 'damage_die', scope: 'canonical' } });
    const res = mockRes();

    await controller.list(req, res);

    expect(Model.findAll).toHaveBeenCalledWith('user-1', req.query, false);
    expect(res.json).toHaveBeenCalledWith({ items: [{ id: 'w1' }] });
  });

  it('flags admins so the model can lift the visibility filter', async () => {
    Model.findAll.mockResolvedValue([]);
    await controller.list(mockReq({ user: { sub: 'user-1', role: 'admin' } }), mockRes());

    expect(Model.findAll).toHaveBeenCalledWith('user-1', {}, true);
  });
});

describe('create', () => {
  it('returns 400 when name is missing', async () => {
    const res = mockRes();

    await controller.create(mockReq({ body: {} }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'name є обовʼязковим' });
    expect(Model.create).not.toHaveBeenCalled();
  });

  it('returns 201 with the created entry on success', async () => {
    Model.create.mockResolvedValue({ id: 'w1', name: 'Меч', type: 'weapon' });
    const res = mockRes();

    await controller.create(mockReq({ body: { name: 'Меч' } }), res);

    expect(Model.create).toHaveBeenCalledWith('user-1', { name: 'Меч' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ item: { id: 'w1', name: 'Меч', type: 'weapon' } });
  });

  it('rethrows unexpected model errors instead of mapping them', async () => {
    const err = new Error('db exploded');
    Model.create.mockRejectedValue(err);

    await expect(controller.create(mockReq({ body: { name: 'Меч' } }), mockRes())).rejects.toBe(err);
  });
});

describe('update', () => {
  it('returns 404 when the entry is neither in this table nor movable into it', async () => {
    Model.update.mockResolvedValue(null);
    const res = mockRes();

    await controller.update(mockReq({ params: { id: 'w1' }, body: { name: 'Меч' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Зброю не знайдено або недостатньо прав' });
  });

  // Форма шле PUT на ендпоінт обраного виду; якщо вид змінився, модель
  // переносить рядок, і контролер віддає його вже з новим type.
  it('returns the entry under its new kind after a cross-table move', async () => {
    Model.update.mockResolvedValue({ id: 'x1', name: 'Меч', type: 'weapon' });
    const res = mockRes();

    await controller.update(mockReq({ params: { id: 'x1' }, body: { name: 'Меч' } }), res);

    expect(Model.update).toHaveBeenCalledWith('x1', 'user-1', { name: 'Меч' }, false);
    expect(res.json).toHaveBeenCalledWith({ item: { id: 'x1', name: 'Меч', type: 'weapon' } });
  });
});

describe('remove', () => {
  it('returns 404 when the entry is not found or not owned', async () => {
    Model.delete.mockResolvedValue(false);
    const res = mockRes();

    await controller.remove(mockReq({ params: { id: 'w1' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Зброю не знайдено або недостатньо прав' });
  });

  it('returns 200 on success', async () => {
    Model.delete.mockResolvedValue(true);
    const res = mockRes();

    await controller.remove(mockReq({ params: { id: 'w1' } }), res);

    expect(Model.delete).toHaveBeenCalledWith('w1', 'user-1', false);
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});

describe('setCanonical', () => {
  it('defaults to marking canonical when the body omits the flag', async () => {
    Model.setCanonical.mockResolvedValue({ id: 'w1', is_canonical: true });
    const res = mockRes();

    await controller.setCanonical(mockReq({ params: { id: 'w1' }, body: {} }), res);

    expect(Model.setCanonical).toHaveBeenCalledWith('w1', true);
    expect(res.json).toHaveBeenCalledWith({ item: { id: 'w1', is_canonical: true } });
  });

  it('honours an explicit false to un-mark it', async () => {
    Model.setCanonical.mockResolvedValue({ id: 'w1', is_canonical: false });

    await controller.setCanonical(mockReq({ params: { id: 'w1' }, body: { is_canonical: false } }), mockRes());

    expect(Model.setCanonical).toHaveBeenCalledWith('w1', false);
  });

  it('returns 404 when the entry does not exist', async () => {
    Model.setCanonical.mockResolvedValue(null);
    const res = mockRes();

    await controller.setCanonical(mockReq({ params: { id: 'gone' }, body: {} }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Зброю не знайдено' });
  });
});

// Корінь сервіса — спільний зріз по чотирьох таблицях, для випадків, коли вид
// наперед невідомий (перехід за голим id) або неважливий (пікери).
describe('UnionController', () => {
  it('forwards only the filters that make sense across kinds', async () => {
    UnionModel.findAll.mockResolvedValue([{ id: 'w1' }, { id: 'i1' }]);
    const req = mockReq({ query: { search: 'меч', scope: 'user', sort: 'price', dir: 'desc', weapon_type: 'melee' } });
    const res = mockRes();

    await UnionController.list(req, res);

    expect(UnionModel.findAll).toHaveBeenCalledWith(
      'user-1', { search: 'меч', scope: 'user', sort: 'price', dir: 'desc' }, false
    );
    expect(res.json).toHaveBeenCalledWith({ items: [{ id: 'w1' }, { id: 'i1' }] });
  });

  it('404s with a kind-neutral message when the id is in no catalog', async () => {
    UnionModel.findById.mockResolvedValue(null);
    const res = mockRes();

    await UnionController.getOne(mockReq({ params: { id: 'ghost' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Спорядження не знайдено' });
  });

  it('returns the entry with the kind resolved for it', async () => {
    UnionModel.findById.mockResolvedValue({ id: 'a1', name: 'Кіраса', type: 'armor' });
    const res = mockRes();

    await UnionController.getOne(mockReq({ params: { id: 'a1' } }), res);

    expect(res.json).toHaveBeenCalledWith({ item: { id: 'a1', name: 'Кіраса', type: 'armor' } });
  });
});
