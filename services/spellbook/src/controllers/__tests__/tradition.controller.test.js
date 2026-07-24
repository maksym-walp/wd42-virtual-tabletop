jest.mock('../../models/tradition.model');

const TraditionModel = require('../../models/tradition.model');
const TraditionController = require('../tradition.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ body = {}, params = {}, query = {}, user = { sub: 'user-1', role: 'user' } } = {}) {
  return { body, params, query, user };
}

beforeEach(() => jest.clearAllMocks());

describe('TraditionController.list', () => {
  it('passes the search query through to the model', async () => {
    TraditionModel.findAll.mockResolvedValue([{ id: 't1' }]);
    const req = mockReq({ query: { search: 'fire' } });
    const res = mockRes();

    await TraditionController.list(req, res);

    expect(TraditionModel.findAll).toHaveBeenCalledWith({ search: 'fire' });
    expect(res.json).toHaveBeenCalledWith({ traditions: [{ id: 't1' }] });
  });
});

describe('TraditionController.getOne', () => {
  it('returns 404 when not found', async () => {
    TraditionModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 't1' } });
    const res = mockRes();

    await TraditionController.getOne(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Традицію не знайдено' });
  });

  it('returns 200 with the tradition on success', async () => {
    TraditionModel.findById.mockResolvedValue({ id: 't1', name: 'Arcane Circle' });
    const req = mockReq({ params: { id: 't1' } });
    const res = mockRes();

    await TraditionController.getOne(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ tradition: { id: 't1', name: 'Arcane Circle' } });
  });
});

describe('TraditionController.create', () => {
  it('returns 400 when name is missing', async () => {
    const req = mockReq({ body: { description: 'desc' } });
    const res = mockRes();

    await TraditionController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'name є обовʼязковим' });
    expect(TraditionModel.create).not.toHaveBeenCalled();
  });

  it('creates with the caller as creator_id and returns 201', async () => {
    TraditionModel.create.mockResolvedValue({ id: 't1', name: 'Arcane Circle' });
    const req = mockReq({ body: { name: 'Arcane Circle' } });
    const res = mockRes();

    await TraditionController.create(req, res);

    expect(TraditionModel.create).toHaveBeenCalledWith('user-1', { name: 'Arcane Circle' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ tradition: { id: 't1', name: 'Arcane Circle' } });
  });
});

describe('TraditionController.update', () => {
  it('returns 404 when not found', async () => {
    TraditionModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 't1' }, body: { name: 'X' } });
    const res = mockRes();

    await TraditionController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Традицію не знайдено' });
  });

  it('returns 200 with the updated tradition', async () => {
    TraditionModel.update.mockResolvedValue({ id: 't1', name: 'X' });
    const req = mockReq({ params: { id: 't1' }, body: { name: 'X' } });
    const res = mockRes();

    await TraditionController.update(req, res);

    expect(res.json).toHaveBeenCalledWith({ tradition: { id: 't1', name: 'X' } });
  });
});

describe('TraditionController.remove', () => {
  it('returns 404 when not found', async () => {
    TraditionModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 't1' } });
    const res = mockRes();

    await TraditionController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Традицію не знайдено' });
  });

  it('returns 200 on success', async () => {
    TraditionModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 't1' } });
    const res = mockRes();

    await TraditionController.remove(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});

describe('TraditionController.addSpell', () => {
  it('returns 400 when spell_id is missing', async () => {
    const req = mockReq({ params: { id: 't1' }, body: {} });
    const res = mockRes();

    await TraditionController.addSpell(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'spell_id є обовʼязковим' });
    expect(TraditionModel.addSpell).not.toHaveBeenCalled();
  });

  it('returns 404 when the model rejects the add', async () => {
    TraditionModel.addSpell.mockResolvedValue(null);
    const req = mockReq({ params: { id: 't1' }, body: { spell_id: 's1' } });
    const res = mockRes();

    await TraditionController.addSpell(req, res);

    expect(TraditionModel.addSpell).toHaveBeenCalledWith('t1', 'user-1', 's1', false);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('passes isAdmin=true when the caller is an admin', async () => {
    TraditionModel.addSpell.mockResolvedValue({ tradition_id: 't1', spell_id: 's1' });
    const req = mockReq({ params: { id: 't1' }, body: { spell_id: 's1' }, user: { sub: 'user-1', role: 'admin' } });
    const res = mockRes();

    await TraditionController.addSpell(req, res);

    expect(TraditionModel.addSpell).toHaveBeenCalledWith('t1', 'user-1', 's1', true);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ item: { tradition_id: 't1', spell_id: 's1' } });
  });
});

describe('TraditionController.removeSpell', () => {
  it('returns 404 when the model rejects the removal', async () => {
    TraditionModel.removeSpell.mockResolvedValue(false);
    const req = mockReq({ params: { id: 't1', spellId: 's1' } });
    const res = mockRes();

    await TraditionController.removeSpell(req, res);

    expect(TraditionModel.removeSpell).toHaveBeenCalledWith('t1', 'user-1', 's1', false);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 200 on success', async () => {
    TraditionModel.removeSpell.mockResolvedValue(true);
    const req = mockReq({ params: { id: 't1', spellId: 's1' } });
    const res = mockRes();

    await TraditionController.removeSpell(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
