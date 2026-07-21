jest.mock('../../models/spell.model');

const SpellModel = require('../../models/spell.model');
const SpellController = require('../spell.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ body = {}, params = {}, query = {}, user = { sub: 'user-1' } } = {}) {
  return { body, params, query, user };
}

beforeEach(() => jest.clearAllMocks());

describe('SpellController.list', () => {
  it('passes query filters through to the model and returns spells', async () => {
    SpellModel.findAll.mockResolvedValue([{ id: 's1' }]);
    const req = mockReq({ query: { magic_type: 'fire', spell_kind: 'attack', ritual: 'possible', search: 'bolt', sort: 'name', scope: 'user' } });
    const res = mockRes();

    await SpellController.list(req, res);

    expect(SpellModel.findAll).toHaveBeenCalledWith('user-1', {
      magicType: 'fire', spellKind: 'attack', ritual: 'possible', search: 'bolt', sort: 'name', scope: 'user',
    }, false);
    expect(res.json).toHaveBeenCalledWith({ spells: [{ id: 's1' }] });
  });

  it('rethrows unexpected model errors', async () => {
    const err = new Error('boom');
    SpellModel.findAll.mockRejectedValue(err);
    const req = mockReq();
    const res = mockRes();
    await expect(SpellController.list(req, res)).rejects.toBe(err);
  });
});

describe('SpellController.getOne', () => {
  it('returns 404 when the spell is not found', async () => {
    SpellModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 's1' } });
    const res = mockRes();

    await SpellController.getOne(req, res);

    expect(SpellModel.findById).toHaveBeenCalledWith('s1', 'user-1', false);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Заклинання не знайдено' });
  });

  it('returns 200 with the spell on success', async () => {
    SpellModel.findById.mockResolvedValue({ id: 's1', name: 'Fireball' });
    const req = mockReq({ params: { id: 's1' } });
    const res = mockRes();

    await SpellController.getOne(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ spell: { id: 's1', name: 'Fireball' } });
  });

  it('rethrows unexpected model errors', async () => {
    const err = new Error('boom');
    SpellModel.findById.mockRejectedValue(err);
    const req = mockReq({ params: { id: 's1' } });
    const res = mockRes();
    await expect(SpellController.getOne(req, res)).rejects.toBe(err);
  });
});

describe('SpellController.create', () => {
  it('returns 400 when name is missing', async () => {
    const req = mockReq({ body: { magic_type: 'fire' } });
    const res = mockRes();

    await SpellController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'name є обовʼязковим' });
    expect(SpellModel.create).not.toHaveBeenCalled();
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    SpellModel.create.mockRejectedValue(err);
    const req = mockReq({ body: { name: 'Fireball' } });
    const res = mockRes();
    await expect(SpellController.create(req, res)).rejects.toBe(err);
  });

  it('returns 201 with the created spell on success', async () => {
    SpellModel.create.mockResolvedValue({ id: 's1', name: 'Fireball' });
    const req = mockReq({ body: { name: 'Fireball' } });
    const res = mockRes();

    await SpellController.create(req, res);

    expect(SpellModel.create).toHaveBeenCalledWith('user-1', { name: 'Fireball' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ spell: { id: 's1', name: 'Fireball' } });
  });
});

describe('SpellController.update', () => {
  it('returns 404 when the spell is not found or not owned', async () => {
    SpellModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 's1' }, body: { name: 'Fireball' } });
    const res = mockRes();

    await SpellController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Заклинання не знайдено або недостатньо прав' });
  });

  it('rethrows unexpected model errors', async () => {
    const err = new Error('boom');
    SpellModel.update.mockRejectedValue(err);
    const req = mockReq({ params: { id: 's1' }, body: { name: 'Fireball' } });
    const res = mockRes();
    await expect(SpellController.update(req, res)).rejects.toBe(err);
  });

  it('returns 200 with the updated spell on success', async () => {
    SpellModel.update.mockResolvedValue({ id: 's1', name: 'Fireball2' });
    const req = mockReq({ params: { id: 's1' }, body: { name: 'Fireball2' } });
    const res = mockRes();

    await SpellController.update(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ spell: { id: 's1', name: 'Fireball2' } });
  });
});

describe('SpellController.remove', () => {
  it('returns 404 when the spell is not found or not owned', async () => {
    SpellModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 's1' } });
    const res = mockRes();

    await SpellController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Заклинання не знайдено або недостатньо прав' });
  });

  it('rethrows unexpected model errors', async () => {
    const err = new Error('boom');
    SpellModel.delete.mockRejectedValue(err);
    const req = mockReq({ params: { id: 's1' } });
    const res = mockRes();
    await expect(SpellController.remove(req, res)).rejects.toBe(err);
  });

  it('returns 200 on success', async () => {
    SpellModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 's1' } });
    const res = mockRes();

    await SpellController.remove(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
