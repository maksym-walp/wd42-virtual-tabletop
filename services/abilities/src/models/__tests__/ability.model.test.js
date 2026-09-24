jest.mock('../../config/db');

const pool = require('../../config/db');
const AbilityModel = require('../ability.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('AbilityModel.findAll sort whitelist', () => {
  it('defaults to sorting by name when sort is omitted', async () => {
    await AbilityModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY a\.name ASC/);
  });

  it('falls back to name for an unrecognized sort value', async () => {
    await AbilityModel.findAll('u1', { sort: "'; DROP TABLE entries; --" });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY a\.name ASC/);
  });
});

describe('AbilityModel.findAll dynamic filter builder', () => {
  it('has only the ownership condition when no filters are given', async () => {
    await AbilityModel.findAll('u1', {});
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE \(a\.user_id = \$1 OR a\.is_public = true\)/);
    expect(params).toEqual(['u1']);
  });

  it('adds a parameterized condition per active filter, in order', async () => {
    await AbilityModel.findAll('u1', { search: 'парирування', archetype: 'rogue' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/a\.name ILIKE \$2/);
    expect(sql).toMatch(/\$3 = ANY\(a\.archetypes\)/);
    expect(params).toEqual(['u1', '%парирування%', 'rogue']);
  });

  it('filters to maneuver-capable abilities when is_maneuver=true', async () => {
    await AbilityModel.findAll('u1', { is_maneuver: 'true' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/a\.is_maneuver = true/);
  });

  it('filters to non-maneuver abilities when is_maneuver=false', async () => {
    await AbilityModel.findAll('u1', { is_maneuver: 'false' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/a\.is_maneuver = false/);
  });

  it('leaves the maneuver filter off when is_maneuver is omitted or empty', async () => {
    await AbilityModel.findAll('u1', { is_maneuver: '' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/is_maneuver/);
  });
});

describe('AbilityModel.findAll scope=community', () => {
  it('replaces the ownership clause with a public/other-user/non-canonical filter', async () => {
    await AbilityModel.findAll('u1', { scope: 'community' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(
      /WHERE a\.is_public = true AND a\.user_id <> \$1 AND NOT \(COALESCE\(cu\.role IN \('admin', 'game_master'\), false\) OR a\.is_canonical\)/
    );
    expect(sql).not.toMatch(/a\.user_id = \$1 OR a\.is_public = true/);
    expect(params).toEqual(['u1']);
  });
});

describe('AbilityModel.findAll limit', () => {
  it('appends a parameterized LIMIT clause when limit is given', async () => {
    await AbilityModel.findAll('u1', { limit: 12 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LIMIT \$2$/);
    expect(params).toEqual(['u1', 12]);
  });

  it('omits the LIMIT clause when limit is not given', async () => {
    await AbilityModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/LIMIT/);
  });
});

describe('AbilityModel.delete', () => {
  it('deletes the entry, relying on the FK cascade to clean up collection_items', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({ rows: [] })                 // BEGIN
      .mockResolvedValueOnce({ rows: [] })                 // childQueries snapshot
      .mockResolvedValueOnce({ rows: [{ id: 'a1' }] })     // the delete itself
      .mockResolvedValue({ rows: [] });                    // trash insert + COMMIT

    await expect(AbilityModel.delete('a1', 'u1')).resolves.toBe(true);

    const deleteCall = client.query.mock.calls.map(([sql]) => sql).find((sql) => sql && /DELETE FROM abilities\.entries/.test(sql));
    expect(deleteCall).toMatch(/DELETE FROM abilities\.entries WHERE id = \$1/);
    expect(deleteCall).not.toMatch(/collection_items/);

    const snapshotCall = client.query.mock.calls.map(([sql]) => sql).find((sql) => sql && /SELECT \* FROM abilities\.collection_items/.test(sql));
    expect(snapshotCall).toMatch(/WHERE ability_id = \$1/);
  });
});

describe('AbilityModel.create', () => {
  it('inserts is_maneuver/duration_value/duration_unit alongside the existing fields', async () => {
    await AbilityModel.create('u1', {
      name: 'Розсічення', archetypes: ['warrior'], mechanical_desc: 'опис', is_public: true,
      prerequisite_node_ids: ['n1'], prerequisite_logic: 'and', image_url: 'img.png',
      is_maneuver: true, duration_value: 3, duration_unit: 'action',
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/is_maneuver, duration_value, duration_unit, lore_creator, lore_creator_npc_id/);
    expect(params).toEqual(['u1', 'Розсічення', ['warrior'], 'опис', null, true, ['n1'], 'and', 'img.png', true, 3, 'action', null, null]);
  });

  it('inserts lore_creator/lore_creator_npc_id when provided', async () => {
    await AbilityModel.create('u1', {
      name: 'Розсічення', lore_creator: 'Легендарний коваль', lore_creator_npc_id: 'npc-1',
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/lore_creator, lore_creator_npc_id/);
    expect(params).toEqual(['u1', 'Розсічення', [], null, null, false, [], 'or', null, false, null, 'instant', 'Легендарний коваль', 'npc-1']);
  });

  it('defaults is_maneuver to false, duration_unit to instant, and lore fields to null when omitted', async () => {
    await AbilityModel.create('u1', { name: 'Вміння' });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['u1', 'Вміння', [], null, null, false, [], 'or', null, false, null, 'instant', null, null]);
  });
});

describe('AbilityModel.update', () => {
  it('updates is_maneuver/duration_value/duration_unit alongside the existing fields', async () => {
    await AbilityModel.update('a1', 'u1', {
      name: 'Розсічення', archetypes: ['warrior'], mechanical_desc: 'опис', is_public: true,
      prerequisite_node_ids: ['n1'], prerequisite_logic: 'and', image_url: 'img.png',
      is_maneuver: true, duration_value: 3, duration_unit: 'action',
    }, true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/is_maneuver=\$11, duration_value=\$12, duration_unit=\$13/);
    expect(sql).toMatch(/lore_creator=\$14, lore_creator_npc_id=\$15/);
    expect(sql).toMatch(/\$16 = true/);
    expect(params).toEqual(['a1', 'u1', 'Розсічення', ['warrior'], 'опис', null, true, ['n1'], 'and', 'img.png', true, 3, 'action', null, null, true]);
  });

  it('updates lore_creator/lore_creator_npc_id when provided', async () => {
    await AbilityModel.update('a1', 'u1', {
      name: 'Розсічення', lore_creator: 'Легендарний коваль', lore_creator_npc_id: 'npc-1',
    });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['a1', 'u1', 'Розсічення', [], null, null, false, [], 'or', null, false, null, 'instant', 'Легендарний коваль', 'npc-1', false]);
  });

  it('defaults is_maneuver to false, duration_unit to instant, and lore fields to null when omitted', async () => {
    await AbilityModel.update('a1', 'u1', { name: 'Вміння' });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['a1', 'u1', 'Вміння', [], null, null, false, [], 'or', null, false, null, 'instant', null, null, false]);
  });
});

describe('AbilityModel.bulkImport', () => {
  it('inserts one multi-row INSERT for the whole batch, forcing user_id to the importer', async () => {
    pool.query.mockResolvedValue({ rowCount: 2 });
    const records = [
      { name: 'Удар', archetypes: ['warrior'], mechanical_desc: 'опис', is_public: true, is_maneuver: true, duration_value: 2, duration_unit: 'action', lore_creator: 'Коваль', lore_creator_npc_id: 'npc-1' },
      { name: 'Ривок' },
    ];

    const result = await AbilityModel.bulkImport('importer-1', records);

    expect(result).toBe(2);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO abilities\.entries \(user_id, name, archetypes, mechanical_desc, narrative_desc, is_public, is_maneuver, duration_value, duration_unit, lore_creator, lore_creator_npc_id\) VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11\), \(\$12, \$13, \$14, \$15, \$16, \$17, \$18, \$19, \$20, \$21, \$22\)/);
    expect(sql).not.toMatch(/prerequisite_node_ids/);
    expect(sql).not.toMatch(/prerequisite_logic/);
    expect(sql).not.toMatch(/is_canonical/);
    expect(sql).not.toMatch(/image_url/);
    expect(params).toEqual([
      'importer-1', 'Удар', ['warrior'], 'опис', null, true, true, 2, 'action', 'Коваль', 'npc-1',
      'importer-1', 'Ривок', [], null, null, false, false, null, 'instant', null, null,
    ]);
  });

  it('skips records without a name and returns 0 without querying when none are valid', async () => {
    const result = await AbilityModel.bulkImport('importer-1', [{ mechanical_desc: 'no name' }, null, { name: '' }]);

    expect(result).toBe(0);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('filters out invalid records but still imports the valid ones', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });
    const records = [{ mechanical_desc: 'no name' }, { name: 'Валідне' }];

    const result = await AbilityModel.bulkImport('importer-1', records);

    expect(result).toBe(1);
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['importer-1', 'Валідне', [], null, null, false, false, null, 'instant', null, null]);
  });
});
