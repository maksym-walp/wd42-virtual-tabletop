jest.mock('../../config/db');

const pool = require('../../config/db');
const MapModel = require('../map.model');

beforeEach(() => jest.clearAllMocks());

describe('MapModel.create', () => {
  it('inserts created_by, name and is_public', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'm1' }] });
    const map = await MapModel.create('u1', 'Old Realm', true);
    expect(map).toEqual({ id: 'm1' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO maps\.maps/);
    expect(sql).toMatch(/RETURNING \*/);
    expect(params).toEqual(['u1', 'Old Realm', true]);
  });
});

describe('MapModel.findById', () => {
  it('returns the row or null', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'm1' }] });
    expect(await MapModel.findById('m1')).toEqual({ id: 'm1' });
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await MapModel.findById('nope')).toBeNull();
  });
});

describe('MapModel.listVisible', () => {
  it('filters to own + public and flags is_owner', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'm1', is_owner: true }] });
    await MapModel.listVisible('u1', false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/\(created_by = \$1\) AS is_owner/);
    expect(sql).toMatch(/is_public = true/);
    expect(sql).toMatch(/\$2::bool/); // admin sees all
    expect(params).toEqual(['u1', false]);
  });
});

describe('MapModel.update', () => {
  it('sets name, is_public and updated_at', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'm1' }] });
    await MapModel.update('m1', 'New', false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE maps\.maps/);
    expect(sql).toMatch(/updated_at = NOW\(\)/);
    expect(params).toEqual(['m1', 'New', false]);
  });
});

describe('MapModel.remove', () => {
  it('reports true/false from rowCount', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await MapModel.remove('m1')).toBe(true);
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await MapModel.remove('gone')).toBe(false);
  });
});
