jest.mock('../../config/db');

const pool = require('../../config/db');
const LocationModel = require('../location.model');

beforeEach(() => jest.clearAllMocks());

describe('LocationModel.create', () => {
  it('inserts created_by + base fields only (name, types, marker icon/level)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'loc1' }] });
    await LocationModel.create({
      createdBy: 'u1', name: 'Rivertown', types: ['city', 'capital'], markerIcon: '🏰', markerLevel: 3,
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO maps\.locations/);
    expect(sql).toMatch(/types/);
    expect(sql).not.toMatch(/description|gm_note|image_url/);
    expect(params).toEqual(['u1', 'Rivertown', ['city', 'capital'], '🏰', 3]);
  });

  it('defaults omitted optional base fields (types -> [])', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'loc1' }] });
    await LocationModel.create({ createdBy: 'u1', name: 'Nowhere' });
    expect(pool.query.mock.calls[0][1]).toEqual(['u1', 'Nowhere', [], null, null]);
  });
});

describe('LocationModel.listByOwner', () => {
  it('scopes by created_by newest first, with a nested versions array', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'loc1', versions: [] }] });
    await LocationModel.listByOwner('u1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE l\.created_by = \$1/);
    expect(sql).toMatch(/ORDER BY l\.created_at DESC/);
    expect(sql).toMatch(/json_agg/);
    expect(sql).toMatch(/maps\.location_versions/);
    expect(params).toEqual(['u1']);
  });
});

describe('LocationModel.findByIdWithVersions', () => {
  it('returns the base row plus its aggregated versions', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'loc1', versions: [] }] });
    await LocationModel.findByIdWithVersions('loc1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM maps\.locations l WHERE l\.id = \$1/);
    expect(sql).toMatch(/json_agg/);
    expect(params).toEqual(['loc1']);
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
  it('updates the base fields and updated_at', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'loc1' }] });
    await LocationModel.update('loc1', { name: 'New', types: ['ruin'], markerIcon: null, markerLevel: 2 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE maps\.locations/);
    expect(sql).toMatch(/updated_at = NOW\(\)/);
    expect(sql).not.toMatch(/description|gm_note|image_url/);
    expect(params).toEqual(['loc1', 'New', ['ruin'], null, 2]);
  });
});

describe('LocationModel.bulkImport', () => {
  const mappers = {
    toBase: (r) => ({ name: r.name, types: r.types ?? [], markerIcon: null, markerLevel: null }),
    toVersion: (v) => ({ startYear: v.start_year ?? null, endYear: v.end_year ?? null, description: v.description ?? null, gmNote: null, name: null, markerIcon: null, markerLevel: null, types: null }),
  };

  it('inserts each location + its versions inside one transaction', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    client.query.mockResolvedValue({ rows: [{ id: 'new-loc' }] });
    pool.connect.mockResolvedValue(client);

    const count = await LocationModel.bulkImport('u1', [
      { name: 'A', versions: [{ start_year: 500 }, { start_year: 600 }] },
      { name: 'B' },
    ], mappers);

    expect(count).toBe(2);
    const sqls = client.query.mock.calls.map((c) => c[0]);
    expect(sqls[0]).toBe('BEGIN');
    expect(sqls.some((s) => /INSERT INTO maps\.locations/.test(s))).toBe(true);
    expect(sqls.some((s) => /INSERT INTO maps\.location_versions/.test(s))).toBe(true);
    expect(sqls[sqls.length - 1]).toBe('COMMIT');
    // B has no versions -> still gets one base version row
    expect(sqls.filter((s) => /INSERT INTO maps\.location_versions/.test(s))).toHaveLength(3);
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back and rethrows on failure', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(new Error('boom'));
    pool.connect.mockResolvedValue(client);

    await expect(LocationModel.bulkImport('u1', [{ name: 'A' }], mappers)).rejects.toThrow('boom');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('skips records without a name', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'x' }] }), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
    const count = await LocationModel.bulkImport('u1', [{ types: ['city'] }, null, 'bad'], mappers);
    expect(count).toBe(0);
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
