jest.mock('../../config/db');

const pool = require('../../config/db');
const SpellModel = require('../spell.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('SpellModel.findAll sort whitelist', () => {
  it('defaults to sorting by name when sort is omitted', async () => {
    await SpellModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY s\.name ASC/);
  });

  it('falls back to name for an unrecognized sort value', async () => {
    await SpellModel.findAll('u1', { sort: "'; DROP TABLE spells; --" });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY s\.name ASC/);
  });

  it('uses the mapped ORDER BY for a recognized sort key', async () => {
    await SpellModel.findAll('u1', { sort: 'energy_cost' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY s\.energy_cost ASC, s\.name ASC/);
  });
});

describe('SpellModel.findAll dynamic filter builder', () => {
  it('has only the ownership condition when no filters are given', async () => {
    await SpellModel.findAll('u1', {});
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE \(s\.user_id = \$1 OR s\.is_public = true\)/);
    expect(params).toEqual(['u1']);
  });

  it('adds a parameterized condition per active filter, in order', async () => {
    await SpellModel.findAll('u1', { nature: 'fire', spellKind: 'attack', ritual: 'possible', search: 'bolt' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/s\.nature && \$2::text\[\]/);
    expect(sql).toMatch(/s\.spell_kind = \$3/);
    expect(sql).toMatch(/s\.ritual = \$4/);
    expect(sql).toMatch(/s\.name ILIKE \$5/);
    expect(params).toEqual(['u1', ['fire'], 'attack', 'possible', '%bolt%']);
  });

  it('wraps a single nature value in an array for the overlap check', async () => {
    await SpellModel.findAll('u1', { nature: 'fire' });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['u1', ['fire']]);
  });

  it('passes multiple nature values through as-is (OR semantics via overlap)', async () => {
    await SpellModel.findAll('u1', { nature: ['fire', 'arcana'] });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/s\.nature && \$2::text\[\]/);
    expect(params).toEqual(['u1', ['fire', 'arcana']]);
  });

  it('adds an EXISTS subquery against tradition_spells when traditionId is given', async () => {
    await SpellModel.findAll('u1', { traditionId: 't1' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(
      /EXISTS \(SELECT 1 FROM spellbook\.tradition_spells ts WHERE ts\.spell_id = s\.id AND ts\.tradition_id = ANY\(\$2::uuid\[\]\)\)/
    );
    expect(params).toEqual(['u1', ['t1']]);
  });

  it('accepts multiple tradition ids (OR semantics via ANY)', async () => {
    await SpellModel.findAll('u1', { traditionId: ['t1', 't2'] });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['u1', ['t1', 't2']]);
  });
});

describe('SpellModel.findAll scope=community', () => {
  it('replaces the ownership clause with a public/other-user/non-canonical filter', async () => {
    await SpellModel.findAll('u1', { scope: 'community' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(
      /WHERE s\.is_public = true AND s\.user_id <> \$1 AND NOT \(COALESCE\(cu\.role IN \('admin', 'game_master'\), false\) OR s\.is_canonical\)/
    );
    expect(sql).not.toMatch(/s\.user_id = \$1 OR s\.is_public = true/);
    expect(params).toEqual(['u1']);
  });
});

describe('SpellModel.findAll limit', () => {
  it('appends a parameterized LIMIT clause when limit is given', async () => {
    await SpellModel.findAll('u1', { limit: 12 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LIMIT \$2$/);
    expect(params).toEqual(['u1', 12]);
  });

  it('omits the LIMIT clause when limit is not given', async () => {
    await SpellModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/LIMIT/);
  });
});

describe('SpellModel.create', () => {
  it('writes lore_creator_npc_id alongside lore_creator', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 's1' }] });
    await SpellModel.create('u1', {
      name: 'Вогняна куля', lore_creator: 'Стара Мірна', lore_creator_npc_id: 'npc-1',
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO spellbook\.spells\s*\(user_id, name, nature, spell_kind, mechanical_desc, narrative_desc,\s*energy_cost, action_time, ritual, duration_value, duration_unit,\s*range_desc, components, is_public, prerequisite_node_ids, prerequisite_logic,\s*image_url, lore_creator, lore_creator_npc_id\)/);
    expect(sql).toMatch(/VALUES \(\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8,\$9,\$10,\$11,\$12,\$13::jsonb,\$14,\$15,\$16,\$17,\$18,\$19\)/);
    expect(params).toEqual([
      'u1', 'Вогняна куля', [], 'utility',
      undefined, undefined,
      0, 1, 'impossible',
      null, 'instant',
      null, '[]', false,
      [], 'or',
      null, 'Стара Мірна', 'npc-1',
    ]);
  });

  it('defaults lore_creator_npc_id to null when omitted', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 's1' }] });
    await SpellModel.create('u1', { name: 'Вогняна куля' });
    const [, params] = pool.query.mock.calls[0];
    expect(params[17]).toBeNull(); // lore_creator
    expect(params[18]).toBeNull(); // lore_creator_npc_id
  });
});

describe('SpellModel.update', () => {
  it('writes lore_creator_npc_id, shifting the isAdmin param to $21', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 's1' }] });
    await SpellModel.update('s1', 'u1', {
      name: 'Вогняна куля', lore_creator: 'Стара Мірна', lore_creator_npc_id: 'npc-1',
    }, true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/image_url=\$18, lore_creator=\$19, lore_creator_npc_id=\$20, updated_at=NOW\(\)/);
    expect(sql).toMatch(/WHERE id=\$1 AND \(user_id=\$2 OR \$21 = true\)/);
    expect(params[19]).toBe('npc-1'); // lore_creator_npc_id ($20)
    expect(params[20]).toBe(true);    // isAdmin ($21)
    expect(params).toHaveLength(21);
  });

  it('defaults lore_creator_npc_id to null when omitted', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 's1' }] });
    await SpellModel.update('s1', 'u1', { name: 'Вогняна куля' }, false);
    const [, params] = pool.query.mock.calls[0];
    expect(params[19]).toBeNull();
  });
});

describe('SpellModel.bulkImport', () => {
  it('issues a single multi-row INSERT with the expected column list', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });
    const imported = await SpellModel.bulkImport('importer', [
      { name: 'Вогняна куля', lore_creator: 'Стара Мірна', lore_creator_npc_id: 'npc-1' },
    ]);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(
      /INSERT INTO spellbook\.spells \(user_id, name, nature, spell_kind, mechanical_desc, narrative_desc, lore_creator, lore_creator_npc_id, energy_cost, action_time, ritual, duration_value, duration_unit, range_desc, components, is_public\)/
    );
    expect(sql).toMatch(/VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11, \$12, \$13, \$14, \$15::jsonb, \$16\)/);
    expect(params).toEqual([
      'importer', 'Вогняна куля', [], 'utility', null, null,
      'Стара Мірна', 'npc-1', 0, 1, 'impossible', null, 'instant', null, '[]', false,
    ]);
    expect(imported).toBe(1);
  });

  it('forces user_id to the importer, regardless of any user_id in the record', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });
    await SpellModel.bulkImport('importer', [{ name: 'X', user_id: 'someone-else' }]);
    const [, params] = pool.query.mock.calls[0];
    expect(params[0]).toBe('importer');
  });

  it('does not include prerequisite_node_ids, prerequisite_logic or is_canonical as columns', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });
    await SpellModel.bulkImport('importer', [
      { name: 'X', prerequisite_node_ids: ['n1'], prerequisite_logic: 'and', is_canonical: true },
    ]);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/prerequisite_node_ids|prerequisite_logic|is_canonical/);
  });

  it('batches multiple records into a single multi-row VALUES list', async () => {
    pool.query.mockResolvedValue({ rowCount: 2 });
    const imported = await SpellModel.bulkImport('importer', [
      { name: 'Вогняна куля' },
      { name: 'Крижана стріла' },
    ]);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(
      /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11, \$12, \$13, \$14, \$15::jsonb, \$16\), \(\$17, \$18, \$19, \$20, \$21, \$22, \$23, \$24, \$25, \$26, \$27, \$28, \$29, \$30, \$31::jsonb, \$32\)/
    );
    expect(imported).toBe(2);
  });

  it('skips records with a falsy or missing name, without querying at all if none remain', async () => {
    const imported = await SpellModel.bulkImport('importer', [
      { name: '' },
      { nature: ['fire'] },
      null,
    ]);
    expect(pool.query).not.toHaveBeenCalled();
    expect(imported).toBe(0);
  });

  it('returns 0 for an empty record list', async () => {
    await expect(SpellModel.bulkImport('importer', [])).resolves.toBe(0);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
