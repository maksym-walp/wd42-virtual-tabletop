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
  // Canonical = authored by an admin/game_master, or explicitly flagged via
  // the "Зробити канонічним" action (a.is_canonical) regardless of owner.
  const CANONICAL_EXPR = "(COALESCE(cu.role IN ('admin', 'game_master'), false) OR a.is_canonical)";

  it('projects is_canonical from the creator role or explicit flag via an auth.users join in findAll', async () => {
    await ArtifactModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LEFT JOIN auth\.users cu ON cu\.id = a\.user_id/);
    expect(sql).toContain(`${CANONICAL_EXPR} AS is_canonical`);
  });

  it('projects is_canonical in findById too', async () => {
    await ArtifactModel.findById('a1', 'u1');
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LEFT JOIN auth\.users cu ON cu\.id = a\.user_id/);
    expect(sql).toContain(`${CANONICAL_EXPR} AS is_canonical`);
  });

  it('restricts to canonical rows when scope=canonical', async () => {
    await ArtifactModel.findAll('u1', { scope: 'canonical' });
    const [sql] = pool.query.mock.calls[0];
    // Appears once in the SELECT projection and once as a WHERE condition.
    expect(sql.split(CANONICAL_EXPR).length - 1).toBe(2);
  });

  it('restricts to non-canonical rows when scope=user', async () => {
    await ArtifactModel.findAll('u1', { scope: 'user' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain(`NOT ${CANONICAL_EXPR}`);
  });

  it('adds no scope condition when scope is omitted', async () => {
    await ArtifactModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    // Only the SELECT projection references the canonical expression; no WHERE condition is added.
    expect(sql.split(CANONICAL_EXPR).length - 1).toBe(1);
  });

  it('replaces the ownership clause with a public/other-user/non-canonical filter when scope=community', async () => {
    await ArtifactModel.findAll('u1', { scope: 'community' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain(`WHERE a.is_public = true AND a.user_id <> $1 AND NOT ${CANONICAL_EXPR}`);
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
    expect(params).toEqual(['a1', 'u1', 'Клинок', null, false, null, null, null, 'rare', false]);
  });

  it('scopes deletion to the owner', async () => {
    pool.query.mockResolvedValue({ rowCount: 0 });
    const deleted = await ArtifactModel.delete('a1', 'u2');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND \(user_id = \$2 OR \$3 = true\)/);
    expect(params).toEqual(['a1', 'u2', false]);
    expect(deleted).toBe(false);
  });
});
