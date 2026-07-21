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
  it('creates an ability from the request body without extra validation', async () => {
    AbilityModel.create.mockResolvedValue({ id: 'a2', name: 'Ривок' });
    const req = mockReq({ body: { name: 'Ривок' } });
    const res = mockRes();

    await AbilityController.create(req, res);

    expect(AbilityModel.create).toHaveBeenCalledWith('user-1', { name: 'Ривок' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ ability: { id: 'a2', name: 'Ривок' } });
  });

  it('does not 400 on an empty body — passes it straight through to the model', async () => {
    AbilityModel.create.mockResolvedValue({ id: 'a3' });
    const req = mockReq({ body: {} });
    const res = mockRes();

    await AbilityController.create(req, res);

    expect(AbilityModel.create).toHaveBeenCalledWith('user-1', {});
    expect(res.status).toHaveBeenCalledWith(201);
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
