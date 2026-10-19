jest.mock('../../models/constellation.model');
jest.mock('../../models/deck.model');

const ConstellationModel = require('../../models/constellation.model');
const DeckModel = require('../../models/deck.model');
const ConstellationController = require('../constellation.controller');
const DeckController = require('../deck.controller');

const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const mockReq = ({ params = {}, body = {}, query = {}, user = { sub: 'u1', role: 'user' } } = {}) => ({
  params, body, query, user,
});

const validConstellation = {
  name: 'Дракон',
  description: 'Сузір\'я дракона',
  data: { stars: [{ id: 'a', x: 1, y: 2, size: 3, name: 'Расабан', description: '' }], lines: [] },
};

beforeEach(() => jest.clearAllMocks());

describe('create', () => {
  it('creates a private document owned by the caller', async () => {
    ConstellationModel.create.mockResolvedValue({ id: 'c1' });
    const res = mockRes();
    await ConstellationController.create(mockReq({ body: validConstellation }), res);

    expect(ConstellationModel.create).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'Дракон', is_public: false }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('only publishes when is_public is exactly true', async () => {
    ConstellationModel.create.mockResolvedValue({ id: 'c1' });
    await ConstellationController.create(mockReq({ body: { ...validConstellation, is_public: 'true' } }), mockRes());
    expect(ConstellationModel.create.mock.calls[0][1].is_public).toBe(false);

    await ConstellationController.create(mockReq({ body: { ...validConstellation, is_public: true } }), mockRes());
    expect(ConstellationModel.create.mock.calls[1][1].is_public).toBe(true);
  });

  it.each([
    ['no name', { ...validConstellation, name: '  ' }],
    ['bad star size', { ...validConstellation, data: { stars: [{ id: 'a', x: 0, y: 0, size: 9 }], lines: [] } }],
    ['non-object body', null],
  ])('400s on %s without touching the model', async (_label, body) => {
    const res = mockRes();
    await ConstellationController.create(mockReq({ body }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ConstellationModel.create).not.toHaveBeenCalled();
  });

  it('rejects a disallowed deck image url', async () => {
    const res = mockRes();
    await DeckController.create(mockReq({ body: { name: 'Таро', back_image_url: 'javascript:alert(1)', data: {} } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(DeckModel.create).not.toHaveBeenCalled();
  });
});

describe('get / access', () => {
  const stored = (extra = {}) => ({ id: 'c1', created_by: 'owner', is_public: false, ...extra });

  it('returns the owner’s private document', async () => {
    ConstellationModel.findById.mockResolvedValue(stored({ created_by: 'u1' }));
    const res = mockRes();
    await ConstellationController.get(mockReq({ params: { id: 'c1' } }), res);
    expect(res.json).toHaveBeenCalledWith({ item: expect.objectContaining({ id: 'c1' }) });
  });

  it('404s (not 403) for someone else’s private document', async () => {
    ConstellationModel.findById.mockResolvedValue(stored());
    const res = mockRes();
    await ConstellationController.get(mockReq({ params: { id: 'c1' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('lets anyone read a public document and an admin read a private one', async () => {
    ConstellationModel.findById.mockResolvedValue(stored({ is_public: true }));
    const publicRes = mockRes();
    await ConstellationController.get(mockReq({ params: { id: 'c1' } }), publicRes);
    expect(publicRes.json).toHaveBeenCalled();

    ConstellationModel.findById.mockResolvedValue(stored());
    const adminRes = mockRes();
    await ConstellationController.get(mockReq({ params: { id: 'c1' }, user: { sub: 'a', role: 'admin' } }), adminRes);
    expect(adminRes.json).toHaveBeenCalled();
  });
});

describe('update / remove', () => {
  const publicOfOthers = { id: 'c1', created_by: 'owner', is_public: true };

  it('403s when a non-owner tries to edit a public document', async () => {
    ConstellationModel.findById.mockResolvedValue(publicOfOthers);
    const res = mockRes();
    await ConstellationController.update(mockReq({ params: { id: 'c1' }, body: validConstellation }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(ConstellationModel.update).not.toHaveBeenCalled();
  });

  it('keeps the current visibility when is_public is omitted', async () => {
    ConstellationModel.findById.mockResolvedValue({ ...publicOfOthers, created_by: 'u1' });
    ConstellationModel.update.mockResolvedValue({ id: 'c1' });
    await ConstellationController.update(mockReq({ params: { id: 'c1' }, body: validConstellation }), mockRes());
    expect(ConstellationModel.update).toHaveBeenCalledWith('c1', expect.objectContaining({ is_public: true }));
  });

  it('lets an admin delete anyone’s document, but not a stranger', async () => {
    ConstellationModel.findById.mockResolvedValue(publicOfOthers);
    ConstellationModel.remove.mockResolvedValue(true);

    const denied = mockRes();
    await ConstellationController.remove(mockReq({ params: { id: 'c1' } }), denied);
    expect(denied.status).toHaveBeenCalledWith(403);

    const allowed = mockRes();
    await ConstellationController.remove(mockReq({ params: { id: 'c1' }, user: { sub: 'a', role: 'admin' } }), allowed);
    expect(ConstellationModel.remove).toHaveBeenCalledWith('c1');
  });
});

describe('export / import', () => {
  it('exports without ids, owner or visibility, tagged with the tool type', async () => {
    DeckModel.findById.mockResolvedValue({
      id: 'd1', created_by: 'u1', is_public: true, name: 'Таро', description: null,
      back_image_url: '/uploads/b.png', data: { suits: [], ranks: [], cards: [] },
    });
    const res = mockRes();
    await DeckController.export(mockReq({ params: { id: 'd1' } }), res);
    expect(res.json).toHaveBeenCalledWith({
      type: 'deck', name: 'Таро', description: null, back_image_url: '/uploads/b.png',
      data: { suits: [], ranks: [], cards: [] },
    });
  });

  it('imports one file or an array as private documents', async () => {
    ConstellationModel.create.mockResolvedValue({ id: 'new' });
    const res = mockRes();
    await ConstellationController.import(mockReq({
      body: [{ ...validConstellation, type: 'constellation', is_public: true }, validConstellation],
    }), res);

    expect(ConstellationModel.create).toHaveBeenCalledTimes(2);
    expect(ConstellationModel.create.mock.calls.every(([, f]) => f.is_public === false)).toBe(true);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ imported: 2 }));
  });

  it('rejects a file of the wrong tool type', async () => {
    const res = mockRes();
    await ConstellationController.import(mockReq({ body: { ...validConstellation, type: 'deck' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ConstellationModel.create).not.toHaveBeenCalled();
  });

  it('inserts nothing when any record in the batch is invalid', async () => {
    const res = mockRes();
    await ConstellationController.import(mockReq({ body: [validConstellation, { ...validConstellation, name: '' }] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ConstellationModel.create).not.toHaveBeenCalled();
  });

  it('400s on an empty batch', async () => {
    const res = mockRes();
    await ConstellationController.import(mockReq({ body: [] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('private gm_notes on constellations', () => {
  const stored = (extra = {}) => ({
    id: 'c1', created_by: 'owner', is_public: true, name: 'Дракон', description: null,
    gm_notes: 'секрет майстра', data: { stars: [], lines: [] }, ...extra,
  });

  it('saves trimmed notes on create and null when empty', async () => {
    ConstellationModel.create.mockResolvedValue({ id: 'c1' });
    await ConstellationController.create(mockReq({ body: { ...validConstellation, gm_notes: '  Нотатка  ' } }), mockRes());
    expect(ConstellationModel.create.mock.calls[0][1].gm_notes).toBe('Нотатка');

    await ConstellationController.create(mockReq({ body: { ...validConstellation, gm_notes: '   ' } }), mockRes());
    expect(ConstellationModel.create.mock.calls[1][1].gm_notes).toBeNull();
  });

  it('400s on over-long notes', async () => {
    const res = mockRes();
    await ConstellationController.create(mockReq({ body: { ...validConstellation, gm_notes: 'x'.repeat(10001) } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('hides notes of a public constellation from other users', async () => {
    ConstellationModel.findById.mockResolvedValue(stored());
    const res = mockRes();
    await ConstellationController.get(mockReq({ params: { id: 'c1' } }), res);
    const { item } = res.json.mock.calls[0][0];
    expect(item).not.toHaveProperty('gm_notes');
    expect(item.name).toBe('Дракон');
  });

  it('shows notes to the author and to an admin', async () => {
    ConstellationModel.findById.mockResolvedValue(stored({ created_by: 'u1' }));
    const own = mockRes();
    await ConstellationController.get(mockReq({ params: { id: 'c1' } }), own);
    expect(own.json.mock.calls[0][0].item.gm_notes).toBe('секрет майстра');

    ConstellationModel.findById.mockResolvedValue(stored());
    const admin = mockRes();
    await ConstellationController.get(mockReq({ params: { id: 'c1' }, user: { sub: 'a', role: 'admin' } }), admin);
    expect(admin.json.mock.calls[0][0].item.gm_notes).toBe('секрет майстра');
  });

  it('keeps notes out of someone else’s export but includes them for the author', async () => {
    ConstellationModel.findById.mockResolvedValue(stored());
    const other = mockRes();
    await ConstellationController.export(mockReq({ params: { id: 'c1' } }), other);
    expect(other.json.mock.calls[0][0]).not.toHaveProperty('gm_notes');

    ConstellationModel.findById.mockResolvedValue(stored({ created_by: 'u1' }));
    const own = mockRes();
    await ConstellationController.export(mockReq({ params: { id: 'c1' } }), own);
    expect(own.json.mock.calls[0][0].gm_notes).toBe('секрет майстра');
  });

  it('does not wipe existing notes when an update omits the field', async () => {
    ConstellationModel.findById.mockResolvedValue(stored({ created_by: 'u1' }));
    ConstellationModel.update.mockResolvedValue({ id: 'c1' });
    await ConstellationController.update(mockReq({ params: { id: 'c1' }, body: validConstellation }), mockRes());
    expect(ConstellationModel.update.mock.calls[0][1].gm_notes).toBe('секрет майстра');

    await ConstellationController.update(mockReq({ params: { id: 'c1' }, body: { ...validConstellation, gm_notes: '' } }), mockRes());
    expect(ConstellationModel.update.mock.calls[1][1].gm_notes).toBeNull();
  });
});
