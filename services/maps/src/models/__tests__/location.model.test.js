jest.mock('../../config/db');

const pool = require('../../config/db');
const LocationModel = require('../location.model');

beforeEach(() => jest.clearAllMocks());

describe('LocationModel.create', () => {
  it('inserts created_by + six columns', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'loc1' }] });
    await LocationModel.create({
      createdBy: 'u1', name: 'Rivertown', description: 'A town',
      gmNote: 'secret', imageUrl: '/uploads/t.jpg', type: 'city',
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO maps\.locations/);
    expect(params).toEqual(['u1', 'Rivertown', 'A town', 'secret', '/uploads/t.jpg', 'city']);
  });

  it('passes null for omitted optional fields', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'loc1' }] });
    await LocationModel.create({ createdBy: 'u1', name: 'Nowhere' });
    expect(pool.query.mock.calls[0][1]).toEqual(['u1', 'Nowhere', null, null, null, null]);
  });
});

describe('LocationModel.listByOwner', () => {
  it('scopes by created_by newest first', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'loc1' }] });
    await LocationModel.listByOwner('u1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE created_by = \$1/);
    expect(sql).toMatch(/ORDER BY created_at DESC/);
    expect(params).toEqual(['u1']);
  });
});

describe('LocationModel.isPinnedOnReadableMap', () => {
  it('joins pins -> maps with the readability filter', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    expect(await LocationModel.isPinnedOnReadableMap('loc1', 'u1', false)).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM maps\.map_pins/);
    expect(sql).toMatch(/JOIN maps\.maps/);
    expect(sql).toMatch(/is_public = true/);
    expect(params).toEqual(['loc1', 'u1', false]);
  });

  it('false when the location is on no readable map', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await LocationModel.isPinnedOnReadableMap('loc1', 'u1', false)).toBe(false);
  });
});

describe('LocationModel.update', () => {
  it('updates the mutable fields and updated_at', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'loc1' }] });
    await LocationModel.update('loc1', { name: 'New', description: null, gmNote: 'n', imageUrl: null, type: 'ruin' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE maps\.locations/);
    expect(sql).toMatch(/updated_at = NOW\(\)/);
    expect(params).toEqual(['loc1', 'New', null, 'n', null, 'ruin']);
  });
});

describe('LocationModel.remove', () => {
  it('reports true/false from rowCount', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await LocationModel.remove('loc1')).toBe(true);
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await LocationModel.remove('gone')).toBe(false);
  });
});
