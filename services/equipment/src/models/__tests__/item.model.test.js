jest.mock('../../config/db');

const pool = require('../../config/db');
const ItemModel = require('../item.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('ItemModel.findAll sorting', () => {
  it('defaults to sorting by name ascending when sort/dir are omitted', async () => {
    await ItemModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY i\.name ASC/);
  });

  it('falls back to name for an unrecognized sort value', async () => {
    await ItemModel.findAll('u1', { sort: "'; DROP TABLE items; --" });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY i\.name ASC/);
  });

  it('sorts by price descending when requested', async () => {
    await ItemModel.findAll('u1', { sort: 'price', dir: 'desc' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY i\.price DESC NULLS LAST, i\.name ASC/);
  });

  it('sorts by defense_value ascending by default direction', async () => {
    await ItemModel.findAll('u1', { sort: 'defense_value' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY i\.defense_value ASC NULLS LAST, i\.name ASC/);
  });

  it('sorts damage_die numerically, not alphabetically', async () => {
    await ItemModel.findAll('u1', { sort: 'damage_die', dir: 'asc' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/regexp_replace\(i\.damage_die/);
  });

  it('ignores an unrecognized dir value and falls back to ASC', async () => {
    await ItemModel.findAll('u1', { sort: 'price', dir: 'sideways' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY i\.price ASC NULLS LAST, i\.name ASC/);
  });
});

describe('ItemModel.findAll dynamic filter builder', () => {
  it('has only the ownership condition when no filters are given', async () => {
    await ItemModel.findAll('u1', {});
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE \(i\.user_id = \$1 OR i\.is_public = true\)/);
    expect(params).toEqual(['u1']);
  });

  it('adds a parameterized condition per active filter, in order', async () => {
    await ItemModel.findAll('u1', {
      type: 'weapon', weaponType: 'melee', armorWeight: 'light', search: 'sword',
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/i\.type = \$2/);
    expect(sql).toMatch(/i\.weapon_type = \$3/);
    expect(sql).toMatch(/i\.armor_weight = \$4/);
    expect(sql).toMatch(/i\.name ILIKE \$5/);
    expect(params).toEqual(['u1', 'weapon', 'melee', 'light', '%sword%']);
  });
});

describe('ItemModel canonical/user split', () => {
  // Canonical = authored by an admin/game_master, or explicitly flagged via
  // the "Зробити канонічним" action (i.is_canonical) regardless of owner.
  const CANONICAL_EXPR = "(COALESCE(cu.role IN ('admin', 'game_master'), false) OR i.is_canonical)";

  it('projects is_canonical from the creator role or explicit flag via an auth.users join in findAll', async () => {
    await ItemModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LEFT JOIN auth\.users cu ON cu\.id = i\.user_id/);
    expect(sql).toContain(`${CANONICAL_EXPR} AS is_canonical`);
  });

  it('projects is_canonical in findById too', async () => {
    await ItemModel.findById('i1', 'u1');
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LEFT JOIN auth\.users cu ON cu\.id = i\.user_id/);
    expect(sql).toContain(`${CANONICAL_EXPR} AS is_canonical`);
  });

  it('restricts to canonical rows when scope=canonical', async () => {
    await ItemModel.findAll('u1', { scope: 'canonical' });
    const [sql] = pool.query.mock.calls[0];
    // Appears once in the SELECT projection and once as a WHERE condition.
    expect(sql.split(CANONICAL_EXPR).length - 1).toBe(2);
  });

  it('restricts to non-canonical rows when scope=user', async () => {
    await ItemModel.findAll('u1', { scope: 'user' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain(`NOT ${CANONICAL_EXPR}`);
  });

  it('adds no scope condition when scope is omitted', async () => {
    await ItemModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    // Only the SELECT projection references the canonical expression; no WHERE condition is added.
    expect(sql.split(CANONICAL_EXPR).length - 1).toBe(1);
  });
});

describe('ItemModel.create / update new fields', () => {
  it('persists the new catalog-detail fields on create', async () => {
    await ItemModel.create('u1', {
      name: 'Меч', type: 'weapon', price: 40, image_url: 'https://x/y.png',
      weapon_type: 'melee', weapon_grip: 'one_handed',
    });
    const params = pool.query.mock.calls[0][1];
    expect(params).toEqual([
      'u1', 'Меч', 'weapon', null, null, null, false,
      40, 'https://x/y.png', 'melee', 'one_handed', null,
    ]);
  });

  it('persists armor fields on update, nulling the weapon-only ones', async () => {
    await ItemModel.update('i1', 'u1', {
      name: 'Кіраса', type: 'armor', defense_value: 3, armor_weight: 'heavy',
    });
    const params = pool.query.mock.calls[0][1];
    expect(params).toEqual([
      'i1', 'u1', 'Кіраса', 'armor', null, 3, null, false,
      null, null, null, null, 'heavy',
    ]);
  });
});
