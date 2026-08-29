jest.mock('../../config/db');

const pool = require('../../config/db');
const LocationVersionModel = require('../location-version.model');

beforeEach(() => jest.clearAllMocks());

describe('LocationVersionModel.listByLocation', () => {
  it('lists a location\'s versions oldest year first, base last', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'v1' }] });
    await LocationVersionModel.listByLocation('loc1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM maps\.location_versions/);
    expect(sql).toMatch(/ORDER BY start_year ASC NULLS LAST/);
    expect(params).toEqual(['loc1']);
  });
});

describe('LocationVersionModel.countByLocation', () => {
  it('returns the integer count', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ count: 2 }] });
    expect(await LocationVersionModel.countByLocation('loc1')).toBe(2);
  });
});

describe('LocationVersionModel.add', () => {
  it('inserts location id, start_year and lore fields', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'v1' }] });
    await LocationVersionModel.add('loc1', {
      startYear: 600, description: 'Ruins', gmNote: 'sunk', imageUrl: '/uploads/r.jpg',
      name: 'Ruins of X', markerIcon: '🏚', markerLevel: 2,
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO maps\.location_versions/);
    expect(params).toEqual(['loc1', 600, 'Ruins', 'sunk', '/uploads/r.jpg', 'Ruins of X', '🏚', 2]);
  });

  it('passes a null start_year (base version) and null overrides through', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'v1' }] });
    await LocationVersionModel.add('loc1', { startYear: null, description: null, gmNote: null, imageUrl: null });
    expect(pool.query.mock.calls[0][1]).toEqual(['loc1', null, null, null, null, null, null, null]);
  });
});

describe('LocationVersionModel.update', () => {
  it('scopes the update by version id and location id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'v1' }] });
    await LocationVersionModel.update('v1', 'loc1', { startYear: 700, description: 'x', gmNote: null, imageUrl: null, name: null, markerIcon: null, markerLevel: null });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND location_id = \$2/);
    expect(params).toEqual(['v1', 'loc1', 700, 'x', null, null, null, null, null]);
  });

  it('returns null when nothing matched', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await LocationVersionModel.update('v1', 'other', { startYear: null })).toBeNull();
  });
});

describe('LocationVersionModel.remove', () => {
  it('scopes the delete by version id and location id', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await LocationVersionModel.remove('v1', 'loc1')).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND location_id = \$2/);
    expect(params).toEqual(['v1', 'loc1']);
  });
});
