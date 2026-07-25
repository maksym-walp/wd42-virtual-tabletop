jest.mock('../../config/db');

const pool = require('../../config/db');
const MapLensModel = require('../map-lens.model');

beforeEach(() => jest.clearAllMocks());

describe('MapLensModel.listByMap', () => {
  it('lists lenses for a map oldest first', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
    const lenses = await MapLensModel.listByMap('m1');
    expect(lenses).toEqual([{ id: 'l1' }]);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM maps\.map_lenses/);
    expect(sql).toMatch(/ORDER BY created_at ASC/);
    expect(params).toEqual(['m1']);
  });
});

describe('MapLensModel.add', () => {
  it('inserts map_id, name and image_url', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
    await MapLensModel.add('m1', 'Political', '/uploads/x.jpg');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO maps\.map_lenses/);
    expect(params).toEqual(['m1', 'Political', '/uploads/x.jpg']);
  });
});

describe('MapLensModel.update', () => {
  it('scopes the update by both lens id and map id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
    await MapLensModel.update('l1', 'm1', { name: 'Geo', imageUrl: 'https://x/y.jpg' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND map_id = \$2/);
    expect(sql).toMatch(/updated_at = NOW\(\)/);
    expect(params).toEqual(['l1', 'm1', 'Geo', 'https://x/y.jpg']);
  });

  it('returns null when nothing matched', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await MapLensModel.update('l1', 'other', { name: 'x', imageUrl: 'https://x' })).toBeNull();
  });
});

describe('MapLensModel.remove', () => {
  it('scopes the delete by both lens id and map id', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await MapLensModel.remove('l1', 'm1')).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND map_id = \$2/);
    expect(params).toEqual(['l1', 'm1']);
  });
});
