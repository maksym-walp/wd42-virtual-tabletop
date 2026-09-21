jest.mock('../../models/ability.model');

const AbilityModel = require('../../models/ability.model');
const AbilityController = require('../ability.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ params = {}, query = {}, body = {}, user = { sub: 'user-1' } } = {}) {
  return { params, query, body, user };
}

beforeEach(() => jest.clearAllMocks());

describe('AbilityController.list', () => {
  it('scopes the lookup to the current user and forwards query filters', async () => {
    AbilityModel.findAll.mockResolvedValue([{ id: 'a1' }]);
    const req = mockReq({ query: { search: 'fire', sort: 'name', archetype: 'mage', scope: 'user' } });
    const res = mockRes();

    await AbilityController.list(req, res);

    expect(AbilityModel.findAll).toHaveBeenCalledWith('user-1', {
      search: 'fire', sort: 'name', archetype: 'mage', scope: 'user',
    }, false);
    expect(res.json).toHaveBeenCalledWith({ abilities: [{ id: 'a1' }] });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('db down');
    AbilityModel.findAll.mockRejectedValue(err);
    const req = mockReq();
    const res = mockRes();

    await expect(AbilityController.list(req, res)).rejects.toBe(err);
  });
});

describe('AbilityController.getOne', () => {
  it('returns 404 when the ability is not found or not visible to the user', async () => {
    AbilityModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await AbilityController.getOne(req, res);

    expect(AbilityModel.findById).toHaveBeenCalledWith('missing', 'user-1', false);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Вміння не знайдено' });
  });

  it('returns 200 with the ability on success', async () => {
    AbilityModel.findById.mockResolvedValue({ id: 'a1', name: 'Удар' });
    const req = mockReq({ params: { id: 'a1' } });
    const res = mockRes();

    await AbilityController.getOne(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ability: { id: 'a1', name: 'Удар' } });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('boom');
    AbilityModel.findById.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'a1' } });
    const res = mockRes();

    await expect(AbilityController.getOne(req, res)).rejects.toBe(err);
  });
});

describe('AbilityController.create', () => {
  it('returns 400 when name is missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await AbilityController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'name є обовʼязковим' });
    expect(AbilityModel.create).not.toHaveBeenCalled();
  });

  it('creates an ability from the request body when name is present', async () => {
    AbilityModel.create.mockResolvedValue({ id: 'a2', name: 'Ривок' });
    const req = mockReq({ body: { name: 'Ривок' } });
    const res = mockRes();

    await AbilityController.create(req, res);

    expect(AbilityModel.create).toHaveBeenCalledWith('user-1', { name: 'Ривок' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ ability: { id: 'a2', name: 'Ривок' } });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('constraint violation');
    AbilityModel.create.mockRejectedValue(err);
    const req = mockReq({ body: { name: 'x' } });
    const res = mockRes();

    await expect(AbilityController.create(req, res)).rejects.toBe(err);
  });
});

describe('AbilityController.update', () => {
  it('returns 404 when the ability is not found or not owned by the user', async () => {
    AbilityModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'a1' }, body: { name: 'Нове' } });
    const res = mockRes();

    await AbilityController.update(req, res);

    expect(AbilityModel.update).toHaveBeenCalledWith('a1', 'user-1', { name: 'Нове' }, false);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Вміння не знайдено або недостатньо прав' });
  });

  it('returns 200 with the updated ability on success', async () => {
    AbilityModel.update.mockResolvedValue({ id: 'a1', name: 'Нове' });
    const req = mockReq({ params: { id: 'a1' }, body: { name: 'Нове' } });
    const res = mockRes();

    await AbilityController.update(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ability: { id: 'a1', name: 'Нове' } });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('boom');
    AbilityModel.update.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'a1' }, body: {} });
    const res = mockRes();

    await expect(AbilityController.update(req, res)).rejects.toBe(err);
  });
});

describe('AbilityController.remove', () => {
  it('returns 404 when nothing was deleted (not found or not owned)', async () => {
    AbilityModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'a1' } });
    const res = mockRes();

    await AbilityController.remove(req, res);

    expect(AbilityModel.delete).toHaveBeenCalledWith('a1', 'user-1', false);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Вміння не знайдено або недостатньо прав' });
  });

  it('returns 200 with a confirmation message on success', async () => {
    AbilityModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'a1' } });
    const res = mockRes();

    await AbilityController.remove(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('boom');
    AbilityModel.delete.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'a1' } });
    const res = mockRes();

    await expect(AbilityController.remove(req, res)).rejects.toBe(err);
  });
});

describe('AbilityController.export', () => {
  it('strips image and system/prerequisite fields before responding with a bare array', async () => {
    AbilityModel.findAll.mockResolvedValue([{
      id: 'a1', name: 'Удар', image_url: '/uploads/abilities/a1.png',
      created_at: '2026-01-01', updated_at: '2026-01-02',
      is_owner: true, owner_username: 'gm', is_canonical: true,
      prerequisite_node_ids: ['n1'], prerequisite_logic: 'and',
      prerequisite_nodes: [{ id: 'n1', title: 'Node' }],
    }]);
    const req = mockReq({ query: { scope: 'canonical' } });
    const res = mockRes();

    await AbilityController.export(req, res);

    expect(res.json).toHaveBeenCalledWith([{ id: 'a1', name: 'Удар' }]);
  });

  it('forwards the same filters as the regular ability list', async () => {
    AbilityModel.findAll.mockResolvedValue([]);
    const req = mockReq({ query: { search: 'удар', sort: 'name', archetype: 'warrior', scope: 'user', limit: 5 } });

    await AbilityController.export(req, mockRes());

    expect(AbilityModel.findAll).toHaveBeenCalledWith(
      'user-1', { search: 'удар', sort: 'name', archetype: 'warrior', scope: 'user', limit: 5 }, false
    );
  });

  it('exports exactly one record, wrapped in an array, when ?id= is given', async () => {
    AbilityModel.findById.mockResolvedValue({ id: 'a1', name: 'Удар', image_url: '/x.png' });
    const req = mockReq({ query: { id: 'a1' } });
    const res = mockRes();

    await AbilityController.export(req, res);

    expect(AbilityModel.findById).toHaveBeenCalledWith('a1', 'user-1', false);
    expect(AbilityModel.findAll).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([{ id: 'a1', name: 'Удар' }]);
  });

  it('exports an empty array when ?id= matches nothing visible to the user', async () => {
    AbilityModel.findById.mockResolvedValue(null);
    const req = mockReq({ query: { id: 'ghost' } });
    const res = mockRes();

    await AbilityController.export(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });
});

describe('AbilityController.import', () => {
  it('rejects a non-array body without touching the model', async () => {
    const req = mockReq({ body: { not: 'an array' } });
    const res = mockRes();

    await AbilityController.import(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(AbilityModel.bulkImport).not.toHaveBeenCalled();
  });

  it('passes the body straight to bulkImport under the current user, returning the count', async () => {
    AbilityModel.bulkImport.mockResolvedValue(2);
    const body = [{ name: 'A' }, { name: 'B' }];
    const req = mockReq({ body });
    const res = mockRes();

    await AbilityController.import(req, res);

    expect(AbilityModel.bulkImport).toHaveBeenCalledWith('user-1', body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ imported: 2 });
  });
});
