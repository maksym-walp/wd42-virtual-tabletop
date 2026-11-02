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
    const req = mockReq({ query: { nature: 'fire', spell_kind: 'attack', ritual: 'possible', search: 'bolt', sort: 'name', scope: 'user', tradition: 't1' } });
    const res = mockRes();

    await SpellController.list(req, res);

    expect(SpellModel.findAll).toHaveBeenCalledWith('user-1', {
      nature: 'fire', spellKind: 'attack', ritual: 'possible', search: 'bolt', sort: 'name', scope: 'user', traditionId: 't1',
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
    const req = mockReq({ body: { nature: ['fire'] } });
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

    expect(SpellModel.create).toHaveBeenCalledWith('user-1', { name: 'Fireball', is_canonical: false });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ spell: { id: 's1', name: 'Fireball' } });
  });

  it('marks a game master\'s spell canonical by default, unless the form unticks it', async () => {
    SpellModel.create.mockResolvedValue({ id: 's1' });
    const user = { sub: 'gm-1', role: 'game_master' };

    await SpellController.create(mockReq({ body: { name: 'A' }, user }), mockRes());
    await SpellController.create(mockReq({ body: { name: 'B', is_canonical: false }, user }), mockRes());

    expect(SpellModel.create).toHaveBeenNthCalledWith(1, 'gm-1', { name: 'A', is_canonical: true });
    expect(SpellModel.create).toHaveBeenNthCalledWith(2, 'gm-1', { name: 'B', is_canonical: false });
  });

  it('ignores is_canonical from a regular user', async () => {
    SpellModel.create.mockResolvedValue({ id: 's1' });
    await SpellController.create(mockReq({ body: { name: 'A', is_canonical: true } }), mockRes());
    expect(SpellModel.create).toHaveBeenCalledWith('user-1', { name: 'A', is_canonical: false });
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

describe('SpellController.export', () => {
  it('strips system/computed fields before responding with a bare array', async () => {
    SpellModel.findAll.mockResolvedValue([{
      id: 's1', name: 'Вогняна куля',
      image_url: '/uploads/spells/s1.png',
      created_at: '2026-01-01', updated_at: '2026-01-02',
      is_owner: true, owner_username: 'gm', is_canonical: true,
      traditions: [{ id: 't1', name: 'Fire' }],
    }]);
    const req = mockReq({ query: { scope: 'canonical' } });
    const res = mockRes();

    await SpellController.export(req, res);

    expect(res.json).toHaveBeenCalledWith([{ id: 's1', name: 'Вогняна куля' }]);
  });

  it('forwards the same filters as the regular list', async () => {
    SpellModel.findAll.mockResolvedValue([]);
    const req = mockReq({ query: { nature: 'fire', spell_kind: 'attack', ritual: 'possible', search: 'bolt', sort: 'name', scope: 'user', tradition: 't1' } });

    await SpellController.export(req, mockRes());

    expect(SpellModel.findAll).toHaveBeenCalledWith('user-1', {
      nature: 'fire', spellKind: 'attack', ritual: 'possible', search: 'bolt', sort: 'name', scope: 'user', limit: undefined, traditionId: 't1',
    }, false);
  });

  it('exports exactly one record, wrapped in an array, when ?id= is given', async () => {
    SpellModel.findById.mockResolvedValue({ id: 's1', name: 'Вогняна куля', image_url: '/x.png' });
    const res = mockRes();

    await SpellController.export(mockReq({ query: { id: 's1' } }), res);

    expect(SpellModel.findById).toHaveBeenCalledWith('s1', 'user-1', false);
    expect(SpellModel.findAll).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([{ id: 's1', name: 'Вогняна куля' }]);
  });

  it('exports an empty array when ?id= matches nothing visible to the user', async () => {
    SpellModel.findById.mockResolvedValue(null);
    const res = mockRes();

    await SpellController.export(mockReq({ query: { id: 'ghost' } }), res);

    expect(res.json).toHaveBeenCalledWith([]);
  });
});

describe('SpellController.import', () => {
  it('rejects a non-array body without touching the model', async () => {
    const res = mockRes();

    await SpellController.import(mockReq({ body: { not: 'an array' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Очікується масив обʼєктів' });
    expect(SpellModel.findAll).not.toHaveBeenCalled();
  });

  it('creates new, canonical spells under the current user when nothing matches', async () => {
    SpellModel.findAll.mockResolvedValue([]);
    SpellModel.create.mockResolvedValue({ id: 's1' });
    const res = mockRes();
    const body = [{ name: 'A' }, { name: 'B' }];

    await SpellController.import(mockReq({ body }), res);

    expect(SpellModel.create).toHaveBeenCalledWith('user-1', expect.objectContaining({ name: 'A', is_canonical: true }));
    expect(SpellModel.create).toHaveBeenCalledWith('user-1', expect.objectContaining({ name: 'B', is_canonical: true }));
    expect(SpellModel.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ imported: 2, created: 2, updated: 0 });
  });

  it('updates an owned spell by id, keeping its image_url/image_crop', async () => {
    const existing = { id: 's1', user_id: 'user-1', name: 'Вогняна куля', image_url: '/uploads/x.png', image_crop: { x: 1 } };
    SpellModel.findAll.mockResolvedValue([existing]);
    SpellModel.update.mockResolvedValue(existing);
    const res = mockRes();

    await SpellController.import(mockReq({ body: [{ id: 's1', name: 'Вогняна куля ІІ' }] }), res);

    expect(SpellModel.update).toHaveBeenCalledWith('s1', 'user-1', expect.objectContaining({
      name: 'Вогняна куля ІІ', image_url: '/uploads/x.png', image_crop: { x: 1 },
    }), false);
    expect(SpellModel.create).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ imported: 1, created: 0, updated: 1 });
  });

  it('matches by name case-insensitively among the importer\'s own spells', async () => {
    const existing = { id: 's1', user_id: 'user-1', name: 'Вогняна куля' };
    SpellModel.findAll.mockResolvedValue([existing]);
    SpellModel.update.mockResolvedValue(existing);
    const res = mockRes();

    await SpellController.import(mockReq({ body: [{ name: ' вогняна куля ' }] }), res);

    expect(SpellModel.update).toHaveBeenCalledWith('s1', 'user-1', expect.anything(), false);
  });

  it('does not match (and instead creates) a same-named spell owned by someone else', async () => {
    const existing = { id: 's1', user_id: 'someone-else', name: 'Вогняна куля' };
    SpellModel.findAll.mockResolvedValue([existing]);
    SpellModel.create.mockResolvedValue({ id: 's2' });
    const res = mockRes();

    await SpellController.import(mockReq({ body: [{ name: 'Вогняна куля' }] }), res);

    expect(SpellModel.update).not.toHaveBeenCalled();
    expect(SpellModel.create).toHaveBeenCalled();
  });

  it('lets an admin match and update any spell by name', async () => {
    const existing = { id: 's1', user_id: 'someone-else', name: 'Вогняна куля' };
    SpellModel.findAll.mockResolvedValue([existing]);
    SpellModel.update.mockResolvedValue(existing);
    const res = mockRes();

    await SpellController.import(mockReq({ body: [{ name: 'Вогняна куля' }], user: { sub: 'admin-1', role: 'admin' } }), res);

    expect(SpellModel.findAll).toHaveBeenCalledWith('admin-1', {}, true);
    expect(SpellModel.update).toHaveBeenCalledWith('s1', 'admin-1', expect.anything(), true);
  });
});

describe('SpellController.getRelated/addRelated/removeRelated', () => {
  it('getRelated returns the model result', async () => {
    SpellModel.getRelated.mockResolvedValue([{ id: 's2', name: 'Крижана стріла' }]);
    const res = mockRes();

    await SpellController.getRelated(mockReq({ params: { id: 's1' } }), res);

    expect(SpellModel.getRelated).toHaveBeenCalledWith('s1', 'user-1', false);
    expect(res.json).toHaveBeenCalledWith({ related: [{ id: 's2', name: 'Крижана стріла' }] });
  });

  it('addRelated 400s without related_id', async () => {
    const res = mockRes();
    await SpellController.addRelated(mockReq({ params: { id: 's1' }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(SpellModel.addRelated).not.toHaveBeenCalled();
  });

  it('addRelated 404s when the model refuses (ownership/visibility)', async () => {
    SpellModel.addRelated.mockResolvedValue(null);
    const res = mockRes();
    await SpellController.addRelated(mockReq({ params: { id: 's1' }, body: { related_id: 's2' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('addRelated 201s with the link on success', async () => {
    SpellModel.addRelated.mockResolvedValue({ spell_id: 's1', related_spell_id: 's2' });
    const res = mockRes();
    await SpellController.addRelated(mockReq({ params: { id: 's1' }, body: { related_id: 's2' } }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ link: { spell_id: 's1', related_spell_id: 's2' } });
  });

  it('removeRelated 404s when nothing was removed', async () => {
    SpellModel.removeRelated.mockResolvedValue(false);
    const res = mockRes();
    await SpellController.removeRelated(mockReq({ params: { id: 's1', relatedId: 's2' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
