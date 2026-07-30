jest.mock('../../config/db');

const pool = require('../../config/db');
const CollectionModel = require('../collection.model');

beforeEach(() => jest.clearAllMocks());

describe('CollectionModel.create', () => {
  it('inserts created_by + name/description/is_public', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await CollectionModel.create('u1', { name: 'Bandit camp', description: 'Ambush pack', is_public: true });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO compendium\.collections/);
    expect(params).toEqual(['u1', 'Bandit camp', 'Ambush pack', true]);
  });
});

describe('CollectionModel.findAll', () => {
  it('filters by own or public unless admin, joins entry items', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await CollectionModel.findAll('u1', {}, false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/created_by = \$1 OR c\.is_public = true/);
    expect(sql).toMatch(/FROM compendium\.collection_items/);
    expect(sql).toMatch(/JOIN compendium\.compendium_entries e ON e\.id = ci\.entry_id/);
    expect(params).toEqual(['u1']);
  });

  it('adds a search filter when provided', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await CollectionModel.findAll('u1', { search: 'bandit' }, false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/c\.name ILIKE \$2/);
    expect(params).toEqual(['u1', '%bandit%']);
  });
});

describe('CollectionModel.findById / findPublicById', () => {
  it('computes is_owner against the given userId', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await CollectionModel.findById('c1', 'u1', false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/\(c\.created_by = \$2\) AS is_owner/);
    expect(params).toEqual(['c1', 'u1']);
  });

  it('findPublicById only matches public collections, is_owner always false', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await CollectionModel.findPublicById('c1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/c\.is_public = true/);
    expect(sql).toMatch(/false AS is_owner/);
    expect(params).toEqual(['c1']);
  });
});

describe('CollectionModel.update', () => {
  it('updates own or admin-overridden collections', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await CollectionModel.update('c1', 'u1', { name: 'New', description: null, is_public: true }, false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE compendium\.collections/);
    expect(sql).toMatch(/WHERE id = \$1 AND \(created_by = \$2 OR \$6 = true\)/);
    expect(params).toEqual(['c1', 'u1', 'New', null, true, false]);
  });
});

describe('CollectionModel.delete', () => {
  it('reports true/false from rowCount', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await CollectionModel.delete('c1', 'u1', false)).toBe(true);
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await CollectionModel.delete('gone', 'u1', false)).toBe(false);
  });
});

describe('CollectionModel.addItem', () => {
  it('null when the caller does not own the collection', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // ownership check fails
    const result = await CollectionModel.addItem('c1', 'u2', 'e1', false);
    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('null when the entry is not visible to the caller', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }); // owns collection
    pool.query.mockResolvedValueOnce({ rows: [] }); // entry not visible
    const result = await CollectionModel.addItem('c1', 'u1', 'e1', false);
    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('inserts the link when owner and entry are both valid', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }); // owns collection
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }); // entry visible
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'link1' }] }); // insert
    const result = await CollectionModel.addItem('c1', 'u1', 'e1', false);
    expect(result).toEqual({ id: 'link1' });
    const [sql, params] = pool.query.mock.calls[2];
    expect(sql).toMatch(/INSERT INTO compendium\.collection_items/);
    expect(sql).toMatch(/ON CONFLICT \(collection_id, entry_id\) DO NOTHING/);
    expect(params).toEqual(['c1', 'e1']);
  });
});

describe('CollectionModel.removeItem', () => {
  it('reports true/false from rowCount', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await CollectionModel.removeItem('c1', 'u1', 'e1', false)).toBe(true);
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await CollectionModel.removeItem('c1', 'u1', 'gone', false)).toBe(false);
  });
});
