jest.mock('../../config/db');

const pool = require('../../config/db');
const ConstellationModel = require('../constellation.model');
const DeckModel = require('../deck.model');

beforeEach(() => jest.clearAllMocks());

describe('findAll', () => {
  beforeEach(() => pool.query.mockResolvedValue({ rows: [] }));

  it('defaults to own + public documents', async () => {
    await DeckModel.findAll('u1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM tools\.decks t/);
    expect(sql).toMatch(/\(t\.created_by = \$1 OR t\.is_public = true\)/);
    expect(params).toEqual(['u1']);
  });

  it('lets an admin see everything in the default scope', async () => {
    await DeckModel.findAll('admin1', {}, true);
    expect(pool.query.mock.calls[0][0]).toMatch(/WHERE TRUE/);
  });

  it('scope=mine restricts to the owner; scope=public to other users’ public documents', async () => {
    await DeckModel.findAll('u1', { scope: 'mine' }, true);
    expect(pool.query.mock.calls[0][0]).toMatch(/WHERE t\.created_by = \$1/);

    await DeckModel.findAll('u1', { scope: 'public' });
    expect(pool.query.mock.calls[1][0]).toMatch(/t\.is_public = true AND t\.created_by <> \$1/);
  });

  it('adds a parameterised name search', async () => {
    await ConstellationModel.findAll('u1', { search: 'Дракон' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/t\.name ILIKE \$2/);
    expect(params).toEqual(['u1', '%Дракон%']);
  });

  it('lists constellations with a light preview instead of the full data blob', async () => {
    await ConstellationModel.findAll('u1');
    const sql = pool.query.mock.calls[0][0];
    expect(sql).toMatch(/AS stars_count/);
    expect(sql).toMatch(/AS preview/);
    expect(sql).not.toMatch(/SELECT t\.\*/);
  });

  it('lists decks with their back image and card counts', async () => {
    await DeckModel.findAll('u1');
    const sql = pool.query.mock.calls[0][0];
    expect(sql).toMatch(/t\.back_image_url/);
    expect(sql).toMatch(/AS cards_count/);
  });
});

describe('create / update', () => {
  it('inserts a constellation with the owner first and data cast to jsonb', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'new' }] });
    await ConstellationModel.create('u1', {
      name: 'Дракон', description: null, is_public: false, data: { stars: [], lines: [] },
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO tools\.constellations \(created_by, name, description, is_public, data\)/);
    expect(sql).toMatch(/\$5::jsonb/);
    expect(params).toEqual(['u1', 'Дракон', null, false, '{"stars":[],"lines":[]}']);
  });

  it('includes back_image_url for decks', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'new' }] });
    await DeckModel.create('u1', {
      name: 'Таро', description: 'Опис', is_public: true, back_image_url: '/uploads/x.png', data: { suits: [], ranks: [], cards: [] },
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/\(created_by, name, description, is_public, back_image_url, data\)/);
    expect(params.slice(0, 5)).toEqual(['u1', 'Таро', 'Опис', true, '/uploads/x.png']);
  });

  it('updates by id, bumps updated_at and returns the row (or null)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'd1' }] }).mockResolvedValueOnce({ rows: [] });
    const fields = { name: 'N', description: null, is_public: false, back_image_url: null, data: { suits: [], ranks: [], cards: [] } };

    await expect(DeckModel.update('d1', fields)).resolves.toEqual({ id: 'd1' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE tools\.decks SET name = \$2, description = \$3, is_public = \$4, back_image_url = \$5, data = \$6::jsonb, updated_at = NOW\(\)\s+WHERE id = \$1/);
    expect(params[0]).toBe('d1');

    await expect(DeckModel.update('missing', fields)).resolves.toBeNull();
  });
});

describe('findById / remove', () => {
  it('finds by id and tags ownership', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'c1', is_owner: true }] });
    await expect(ConstellationModel.findById('c1', 'u1')).resolves.toMatchObject({ id: 'c1' });
    expect(pool.query.mock.calls[0][1]).toEqual(['c1', 'u1']);
  });

  it('returns null when not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await expect(ConstellationModel.findById('nope', 'u1')).resolves.toBeNull();
  });

  it('reports whether a row was deleted', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rowCount: 0 });
    await expect(DeckModel.remove('d1')).resolves.toBe(true);
    await expect(DeckModel.remove('d1')).resolves.toBe(false);
  });
});
