jest.mock('../../config/db');

const pool = require('../../config/db');
const { createCatalogModel, findKindById, UnionModel } = require('../catalog.model');

const ItemModel = createCatalogModel('item');
const WeaponModel = createCatalogModel('weapon');
const ArmorModel = createCatalogModel('armor');

function mockClient() {
  const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
  pool.connect.mockResolvedValue(client);
  return client;
}

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('per-kind tables', () => {
  it('queries the table that belongs to the kind, never a shared one', async () => {
    await ItemModel.findAll('u1', {});
    await WeaponModel.findAll('u1', {});
    await ArmorModel.findAll('u1', {});

    const [items, weapons, armor] = pool.query.mock.calls.map(([sql]) => sql);
    expect(items).toMatch(/FROM equipment\.items i/);
    expect(weapons).toMatch(/FROM equipment\.weapons i/);
    expect(armor).toMatch(/FROM equipment\.armor i/);
  });

  // The `type` column is gone — the table is the type — but consumers (sheet
  // rows, catalog cards, collection entries) still read `type` off the row.
  it('projects the kind onto returned rows even though no column holds it', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'w1', name: 'Меч' }] });
    await expect(WeaponModel.findAll('u1', {})).resolves.toEqual([{ id: 'w1', name: 'Меч', type: 'weapon' }]);

    pool.query.mockResolvedValue({ rows: [{ id: 'a1', name: 'Кіраса' }] });
    await expect(ArmorModel.findById('a1', 'u1')).resolves.toEqual({ id: 'a1', name: 'Кіраса', type: 'armor' });
  });

  it('returns null from findById when nothing is visible, rather than a bare type stub', async () => {
    await expect(ItemModel.findById('missing', 'u1')).resolves.toBeNull();
  });
});

describe('findAll sorting', () => {
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

  it('ignores an unrecognized dir value and falls back to ASC', async () => {
    await ItemModel.findAll('u1', { sort: 'price', dir: 'sideways' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY i\.price ASC NULLS LAST, i\.name ASC/);
  });

  it('sorts damage_die numerically, not alphabetically', async () => {
    await WeaponModel.findAll('u1', { sort: 'damage_die', dir: 'asc' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/regexp_replace\(i\.damage_die/);
  });

  it('sorts armor by defense_value', async () => {
    await ArmorModel.findAll('u1', { sort: 'defense_value' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY i\.defense_value ASC NULLS LAST, i\.name ASC/);
  });

  // Each kind only knows its own sort keys; another kind's key is not a column
  // in its table, so it must degrade to the default instead of erroring.
  it('ignores a sort key belonging to a different kind', async () => {
    await ArmorModel.findAll('u1', { sort: 'damage_die' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY i\.name ASC/);
  });
});

describe('findAll dynamic filter builder', () => {
  it('has only the ownership condition when no filters are given', async () => {
    await ItemModel.findAll('u1', {});
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE \(i\.user_id = \$1 OR i\.is_public = true\)/);
    expect(params).toEqual(['u1']);
  });

  it('adds a parameterized condition per active filter, in order', async () => {
    await WeaponModel.findAll('u1', { weapon_type: 'melee', search: 'sword' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/i\.weapon_type = \$2/);
    expect(sql).toMatch(/i\.name ILIKE \$3/);
    expect(params).toEqual(['u1', 'melee', '%sword%']);
  });

  it('applies the armor-only filter on the armor table', async () => {
    await ArmorModel.findAll('u1', { armor_weight: 'light' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/i\.armor_weight = \$2/);
    expect(params).toEqual(['u1', 'light']);
  });

  it('ignores a filter belonging to a different kind', async () => {
    await ItemModel.findAll('u1', { weapon_type: 'melee', armor_weight: 'light' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/weapon_type|armor_weight/);
    expect(params).toEqual(['u1']);
  });
});

describe('canonical/user split', () => {
  // Canonical = authored by an admin/game_master, or explicitly flagged via
  // the "Зробити канонічним" action (i.is_canonical) regardless of owner.
  const CANONICAL_EXPR = "(COALESCE(cu.role IN ('admin', 'game_master'), false) OR i.is_canonical)";

  it('projects is_canonical from the creator role or explicit flag via an auth.users join in findAll', async () => {
    await WeaponModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LEFT JOIN auth\.users cu ON cu\.id = i\.user_id/);
    expect(sql).toContain(`${CANONICAL_EXPR} AS is_canonical`);
  });

  it('projects is_canonical in findById too', async () => {
    await WeaponModel.findById('w1', 'u1');
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

describe('create / update column sets', () => {
  it('writes only the columns its own table has', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'w1' }] });
    await WeaponModel.create('u1', {
      name: 'Меч', price: 40, image_url: 'https://x/y.png',
      weapon_type: 'melee', weapon_grip: 'one_handed',
      // Поля іншого виду — не колонки цієї таблиці, тож мають бути відкинуті.
      defense_value: 3, armor_weight: 'heavy',
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO equipment\.weapons \(user_id, name, description, is_public, price, image_url, damage_die, weapon_type, weapon_grip\)/);
    expect(params).toEqual(['u1', 'Меч', null, false, 40, 'https://x/y.png', null, 'melee', 'one_handed']);
  });

  it('defaults is_public to false and every other unset column to NULL', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'i1' }] });
    await ItemModel.create('u1', { name: 'Мотузка' });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['u1', 'Мотузка', null, false, null, null]);
  });

  it('updates the armor-only columns, leaving the id/owner/admin params first', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'a1' }] });
    await ArmorModel.update('a1', 'u1', { name: 'Кіраса', defense_value: 3, armor_weight: 'heavy' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/SET name=\$4, description=\$5, is_public=\$6, price=\$7, image_url=\$8, defense_value=\$9, armor_weight=\$10, updated_at=NOW\(\)/);
    expect(params).toEqual(['a1', 'u1', false, 'Кіраса', null, false, null, null, 3, 'heavy']);
  });

  it('tags the created row with its kind', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'a1', name: 'Кіраса' }] });
    await expect(ArmorModel.create('u1', { name: 'Кіраса' })).resolves.toEqual({ id: 'a1', name: 'Кіраса', type: 'armor' });
  });
});

describe('delete', () => {
  it('unlinks the entry from collections in the same statement, since the FK no longer cascades', async () => {
    const client = mockClient();
    client.query.mockResolvedValueOnce({ rows: [] })           // BEGIN
      .mockResolvedValueOnce({ rows: [] })                     // childQueries snapshot
      .mockResolvedValueOnce({ rows: [{ id: 'w1' }] })         // the delete itself
      .mockResolvedValue({ rows: [] });                        // trash insert + COMMIT

    await expect(WeaponModel.delete('w1', 'u1')).resolves.toBe(true);

    const deleteSql = client.query.mock.calls.map(([sql]) => sql).find((sql) => /DELETE FROM equipment\.weapons/.test(sql));
    expect(deleteSql).toMatch(/DELETE FROM equipment\.collection_items WHERE item_id = \$1/);
  });

  it('files the row under its own table name in trash, not a shared one', async () => {
    const client = mockClient();
    client.query.mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'a1' }] })
      .mockResolvedValue({ rows: [] });

    await ArmorModel.delete('a1', 'u1');

    const trashCall = client.query.mock.calls.find(([sql]) => /trash\.deleted_records/.test(sql));
    expect(trashCall[1].slice(0, 3)).toEqual(['equipment', 'armor', 'a1']);
  });

  it('reports failure when the entry is not owned', async () => {
    const client = mockClient();
    client.query.mockResolvedValue({ rows: [] });
    await expect(ItemModel.delete('i1', 'someone-else')).resolves.toBe(false);
  });
});

describe('update across kinds', () => {
  // Switching an entry's kind in the form moves the row between tables rather
  // than updating a column, since the kind IS the table now.
  it('moves the row, keeping its id, owner and created_at, when it lives in another table', async () => {
    pool.query.mockResolvedValue({ rows: [] }); // не знайшлось у власній таблиці
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })                                                     // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'x1', user_id: 'owner', created_at: 'ts' }] })     // DELETE з equipment.items
      .mockResolvedValueOnce({ rows: [{ id: 'x1', name: 'Меч' }] })                            // INSERT у equipment.weapons
      .mockResolvedValue({ rows: [] });                                                        // relink + COMMIT

    const moved = await WeaponModel.update('x1', 'owner', { name: 'Меч', damage_die: 'd8' });

    const insert = client.query.mock.calls.find(([sql]) => /INSERT INTO equipment\.weapons/.test(sql));
    expect(insert[0]).toMatch(/\(id, user_id, created_at, name, description, is_public, price, image_url, damage_die, weapon_type, weapon_grip\)/);
    expect(insert[1].slice(0, 3)).toEqual(['x1', 'owner', 'ts']);
    expect(moved).toEqual({ id: 'x1', name: 'Меч', type: 'weapon' });
  });

  it('repoints the collection links at the new kind', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'x1', user_id: 'owner', created_at: 'ts' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'x1' }] })
      .mockResolvedValue({ rows: [] });

    await WeaponModel.update('x1', 'owner', { name: 'Меч' });

    const relink = client.query.mock.calls.find(([sql]) => /UPDATE equipment\.collection_items/.test(sql));
    expect(relink[1]).toEqual(['x1', 'weapon']);
  });

  it('rolls back and reports not-found when the id exists in no other table either', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const client = mockClient();
    client.query.mockResolvedValue({ rows: [] });

    await expect(WeaponModel.update('ghost', 'u1', { name: 'X' })).resolves.toBeNull();
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('never touches the connection when the plain update already matched', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'w1', name: 'Меч' }] });

    await expect(WeaponModel.update('w1', 'u1', { name: 'Меч' })).resolves.toEqual({ id: 'w1', name: 'Меч', type: 'weapon' });
    expect(pool.connect).not.toHaveBeenCalled();
  });
});

describe('findKindById', () => {
  it('probes all three tables and reports where the id lives', async () => {
    pool.query.mockResolvedValue({ rows: [{ kind: 'armor' }] });

    await expect(findKindById('a1', 'u1')).resolves.toBe('armor');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM equipment\.items/);
    expect(sql).toMatch(/FROM equipment\.weapons/);
    expect(sql).toMatch(/FROM equipment\.armor/);
    expect(params).toEqual(['a1', 'u1']);
  });

  it('respects visibility, returning null for someone elseʼs private entry', async () => {
    await expect(findKindById('a1', 'u1')).resolves.toBeNull();
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/\(user_id = \$2 OR is_public = true\)/);
  });

  it('drops the visibility filter for admins', async () => {
    await findKindById('a1', 'u1', true);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/is_public = true/);
  });
});

describe('UnionModel', () => {
  it('reads all three tables at once, tagging each arm with its kind', async () => {
    await UnionModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/'item'::varchar AS type[\s\S]*FROM equipment\.items/);
    expect(sql).toMatch(/'weapon'::varchar[\s\S]*FROM equipment\.weapons/);
    expect(sql).toMatch(/'armor'::varchar[\s\S]*FROM equipment\.armor/);
  });

  it('only offers the sort keys every kind shares', async () => {
    await UnionModel.findAll('u1', { sort: 'damage_die' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY i\.name ASC/);
  });

  it('resolves a bare id without knowing its kind, and lists the spells using it', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'x1', type: 'weapon' }] });

    await expect(UnionModel.findById('x1', 'u1')).resolves.toEqual({ id: 'x1', type: 'weapon' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/AS used_in_spells/);
  });
});
