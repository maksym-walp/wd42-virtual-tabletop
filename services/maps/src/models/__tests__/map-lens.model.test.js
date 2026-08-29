jest.mock('../../config/db');

const pool = require('../../config/db');
const MapLensModel = require('../map-lens.model');

beforeEach(() => jest.clearAllMocks());

describe('MapLensModel.listByMap', () => {
  it('lists lenses oldest first, each with a nested versions array', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'l1', versions: [] }] });
    const lenses = await MapLensModel.listByMap('m1');
    expect(lenses).toEqual([{ id: 'l1', versions: [] }]);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM maps\.map_lenses/);
    expect(sql).toMatch(/map_lens_versions/);
    expect(sql).toMatch(/json_agg/);
    expect(sql).toMatch(/ORDER BY l\.created_at ASC/);
    expect(params).toEqual(['m1']);
  });
});

describe('MapLensModel.findById', () => {
  it('scopes the lookup by both lens id and map id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
    await MapLensModel.findById('l1', 'm1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND map_id = \$2/);
    expect(params).toEqual(['l1', 'm1']);
  });
});

describe('MapLensModel.add', () => {
  it('inserts just the lens identity (map_id, name)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
    await MapLensModel.add('m1', 'Political');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO maps\.map_lenses/);
    expect(sql).not.toMatch(/image_url/);
    expect(params).toEqual(['m1', 'Political']);
  });
});

describe('MapLensModel.update', () => {
  it('renames, scoped by both lens id and map id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'l1' }] });
    await MapLensModel.update('l1', 'm1', { name: 'Geo' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND map_id = \$2/);
    expect(sql).not.toMatch(/image_url/);
    expect(params).toEqual(['l1', 'm1', 'Geo']);
  });

  it('returns null when nothing matched', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await MapLensModel.update('l1', 'other', { name: 'x' })).toBeNull();
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
