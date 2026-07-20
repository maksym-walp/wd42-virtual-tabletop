jest.mock('../../config/db');

const pool = require('../../config/db');
const ArtifactModel = require('../artifact.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('ArtifactModel.findAll sorting', () => {
  it('defaults to sorting by name ascending when sort/dir are omitted', async () => {
    await ArtifactModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY a\.name ASC/);
  });

  it('falls back to name for an unrecognized sort value', async () => {
    await ArtifactModel.findAll('u1', { sort: "'; DROP TABLE entries; --" });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY a\.name ASC/);
  });

  it('sorts by price descending when requested', async () => {
    await ArtifactModel.findAll('u1', { sort: 'price', dir: 'desc' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY a\.price DESC NULLS LAST, a\.name ASC/);
  });

  it('sorts rarity by its in-world scale, not alphabetically', async () => {
    await ArtifactModel.findAll('u1', { sort: 'rarity' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/array_position\(ARRAY\['common','uncommon','rare','legendary'\], a\.rarity\) ASC/);
  });

  it('ignores an unrecognized dir value and falls back to ASC', async () => {
    await ArtifactModel.findAll('u1', { sort: 'price', dir: 'sideways' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY a\.price ASC NULLS LAST, a\.name ASC/);
  });
});

describe('ArtifactModel.findAll dynamic filter builder', () => {
  it('has only the ownership condition when no filters are given', async () => {
    await ArtifactModel.findAll('u1', {});
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE \(a\.user_id = \$1 OR a\.is_public = true\)/);
    expect(params).toEqual(['u1']);
  });

  it('adds a parameterized condition per active filter, in order', async () => {
    await ArtifactModel.findAll('u1', { rarity: 'rare', creator: 'Аранель', search: 'клинок' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/a\.rarity = \$2/);
    expect(sql).toMatch(/a\.creator = \$3/);
    expect(sql).toMatch(/a\.name ILIKE \$4/);
    expect(params).toEqual(['u1', 'rare', 'Аранель', '%клинок%']);
  });
});

describe('ArtifactModel canonical/user split', () => {
  it('projects is_canonical from the creator role via an auth.users join in findAll', async () => {
    await ArtifactModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LEFT JOIN auth\.users cu ON cu\.id = a\.user_id/);
    expect(sql).toMatch(/COALESCE\(cu\.role = 'admin', false\) AS is_canonical/);
  });

  it('projects is_canonical in findById too', async () => {
    await ArtifactModel.findById('a1', 'u1');
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LEFT JOIN auth\.users cu ON cu\.id = a\.user_id/);
    expect(sql).toMatch(/COALESCE\(cu\.role = 'admin', false\) AS is_canonical/);
  });

  it('restricts to admin-authored rows when scope=canonical', async () => {
    await ArtifactModel.findAll('u1', { scope: 'canonical' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/AND cu\.role = 'admin'/);
    expect(sql).not.toMatch(/IS DISTINCT FROM/);
  });

  it('restricts to non-admin rows when scope=user', async () => {
    await ArtifactModel.findAll('u1', { scope: 'user' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/cu\.role IS DISTINCT FROM 'admin'/);
  });

  it('adds no scope condition when scope is omitted', async () => {
    await ArtifactModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    // The projection always references cu.role; a scope *condition* is joined with AND.
    expect(sql).not.toMatch(/AND cu\.role = 'admin'/);
    expect(sql).not.toMatch(/IS DISTINCT FROM/);
  });

  it('replaces the ownership clause with a public/other-user/non-admin filter when scope=community', async () => {
    await ArtifactModel.findAll('u1', { scope: 'community' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE a\.is_public = true AND a\.user_id <> \$1 AND cu\.role IS DISTINCT FROM 'admin'/);
    expect(sql).not.toMatch(/a\.user_id = \$1 OR a\.is_public = true/);
    expect(params).toEqual(['u1']);
  });
});

describe('ArtifactModel.findAll limit', () => {
  it('appends a parameterized LIMIT clause when limit is given', async () => {
    await ArtifactModel.findAll('u1', { limit: 12 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LIMIT \$2$/);
    expect(params).toEqual(['u1', 12]);
  });

  it('omits the LIMIT clause when limit is not given', async () => {
    await ArtifactModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/LIMIT/);
  });
});

describe('ArtifactModel.create / update', () => {
  it('persists the artifact fields on create', async () => {
    await ArtifactModel.create('u1', {
      name: 'Клинок', creator: 'Аранель', rarity: 'legendary',
      price: 400, image_url: 'https://x/y.png',
    });
    const params = pool.query.mock.calls[0][1];
    expect(params).toEqual([
      'u1', 'Клинок', null, false, 400, 'https://x/y.png', 'Аранель', 'legendary',
    ]);
  });

  it('nulls out omitted optional fields on update', async () => {
    await ArtifactModel.update('a1', 'u1', { name: 'Клинок', rarity: 'rare' });
    const params = pool.query.mock.calls[0][1];
    expect(params).toEqual(['a1', 'u1', 'Клинок', null, false, null, null, null, 'rare']);
  });

  it('scopes deletion to the owner', async () => {
    pool.query.mockResolvedValue({ rowCount: 0 });
    const deleted = await ArtifactModel.delete('a1', 'u2');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND user_id = \$2/);
    expect(params).toEqual(['a1', 'u2']);
    expect(deleted).toBe(false);
  });
});
