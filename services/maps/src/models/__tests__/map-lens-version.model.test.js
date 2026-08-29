jest.mock('../../config/db');

const pool = require('../../config/db');
const MapLensVersionModel = require('../map-lens-version.model');

beforeEach(() => jest.clearAllMocks());

describe('MapLensVersionModel.listByLens', () => {
  it('lists a lens\'s versions oldest year first, timeless last', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'v1' }] });
    await MapLensVersionModel.listByLens('l1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM maps\.map_lens_versions/);
    expect(sql).toMatch(/ORDER BY year ASC NULLS LAST/);
    expect(params).toEqual(['l1']);
  });
});

describe('MapLensVersionModel.countByLens', () => {
  it('returns the integer count', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ count: 3 }] });
    expect(await MapLensVersionModel.countByLens('l1')).toBe(3);
  });
});

describe('MapLensVersionModel.add', () => {
  it('inserts lens id, year and image_url', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'v1' }] });
    await MapLensVersionModel.add('l1', { year: 1200, imageUrl: '/uploads/x.jpg' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO maps\.map_lens_versions/);
    expect(params).toEqual(['l1', 1200, '/uploads/x.jpg']);
  });

  it('passes a null year through', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'v1' }] });
    await MapLensVersionModel.add('l1', { year: null, imageUrl: 'https://x/y.jpg' });
    expect(pool.query.mock.calls[0][1]).toEqual(['l1', null, 'https://x/y.jpg']);
  });
});

describe('MapLensVersionModel.update', () => {
  it('scopes the update by version id and lens id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'v1' }] });
    await MapLensVersionModel.update('v1', 'l1', { year: 1300, imageUrl: 'https://x/z.jpg' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND map_lens_id = \$2/);
    expect(params).toEqual(['v1', 'l1', 1300, 'https://x/z.jpg']);
  });

  it('returns null when nothing matched', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await MapLensVersionModel.update('v1', 'other', { year: null, imageUrl: 'https://x' })).toBeNull();
  });
});

describe('MapLensVersionModel.remove', () => {
  it('scopes the delete by version id and lens id', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await MapLensVersionModel.remove('v1', 'l1')).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND map_lens_id = \$2/);
    expect(params).toEqual(['v1', 'l1']);
  });
});
