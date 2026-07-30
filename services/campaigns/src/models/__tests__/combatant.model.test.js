jest.mock('../../config/db');

const pool = require('../../config/db');
const CombatantModel = require('../combatant.model');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CombatantModel.listByScene', () => {
  it('orders by initiative descending, nulls last', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'cb1' }, { id: 'cb2' }] });
    const rows = await CombatantModel.listByScene('s1');
    expect(rows).toEqual([{ id: 'cb1' }, { id: 'cb2' }]);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE combat_scene_id = \$1/);
    expect(sql).toMatch(/ORDER BY initiative DESC NULLS LAST, created_at/);
    expect(params).toEqual(['s1']);
  });
});

describe('CombatantModel.add', () => {
  it('inserts a custom NPC (no character_id) with the given fields', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'cb1', name: 'Goblin' }] });
    const combatant = await CombatantModel.add('s1', {
      name: 'Goblin', passive_defense: 12, active_defense: 14, health: 7,
      initiative: 3, notes: 'weak', description: 'a sneaky goblin', is_hidden: true,
      max_health: 20, temp_hp: 5,
    });
    expect(combatant).toEqual({ id: 'cb1', name: 'Goblin' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO campaigns\.combatants/);
    expect(params).toEqual(['s1', null, 'Goblin', 12, 14, 7, 3, 'weak', 'a sneaky goblin', true, 20, 5]);
  });

  it('links a character_id when provided and defaults optional fields', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'cb1' }] });
    await CombatantModel.add('s1', { character_id: 'ch1', name: 'Hero' });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['s1', 'ch1', 'Hero', null, null, null, null, null, null, false, null, null]);
  });
});

describe('CombatantModel.addMany', () => {
  function mockClient() {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
    return client;
  }

  it('inserts one row per entry inside a transaction and returns them all', async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'cb1', name: 'Goblin 1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'cb2', name: 'Goblin 2' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'cb3', name: 'Goblin 3' }] })
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const combatants = await CombatantModel.addMany('s1', [
      { compendium_entry_id: 'e1', name: 'Goblin 1', active_defense: 15, health: 9, max_health: 9, temp_hp: 0, initiative: 5 },
      { compendium_entry_id: 'e1', name: 'Goblin 2', active_defense: 15, health: 9, max_health: 9, temp_hp: 0, initiative: 5 },
      { compendium_entry_id: 'e1', name: 'Goblin 3', active_defense: 15, health: 9, max_health: 9, temp_hp: 0, initiative: 5 },
    ]);

    expect(combatants).toEqual([{ id: 'cb1', name: 'Goblin 1' }, { id: 'cb2', name: 'Goblin 2' }, { id: 'cb3', name: 'Goblin 3' }]);
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    const [insertSql, insertParams] = client.query.mock.calls[1];
    expect(insertSql).toMatch(/INSERT INTO campaigns\.combatants/);
    expect(insertParams).toEqual(['s1', 'e1', 'Goblin 1', null, 15, 9, 5, null, null, false, 9, 0]);
    expect(client.query).toHaveBeenNthCalledWith(5, 'COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back and rethrows if any insert fails, releasing the client either way', async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce(new Error('boom'));

    await expect(CombatantModel.addMany('s1', [{ name: 'Goblin 1' }])).rejects.toThrow('boom');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('CombatantModel.update', () => {
  it('scopes the update through combat_scenes by campaign_id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'cb1', health: 5 }] });
    const combatant = await CombatantModel.update('cb1', 'c1', { health: 5 });
    expect(combatant).toEqual({ id: 'cb1', health: 5 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM campaigns\.combat_scenes s/);
    expect(sql).toMatch(/WHERE c\.id = \$1 AND c\.combat_scene_id = s\.id AND s\.campaign_id = \$2/);
    expect(params).toEqual(['cb1', 'c1', null, null, null, 5, null, null, null, null, null, null]);
  });

  it('overwrites is_hidden to false explicitly (not treated as "omitted")', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'cb1', is_hidden: false }] });
    await CombatantModel.update('cb1', 'c1', { is_hidden: false });
    const [, params] = pool.query.mock.calls[0];
    expect(params[9]).toBe(false);
  });

  it('passes max_health and temp_hp through via COALESCE', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'cb1', max_health: 30, temp_hp: 10 }] });
    await CombatantModel.update('cb1', 'c1', { max_health: 30, temp_hp: 10 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/max_health\s*=\s*COALESCE\(\$11, c\.max_health\)/);
    expect(sql).toMatch(/temp_hp\s*=\s*COALESCE\(\$12, c\.temp_hp\)/);
    expect(params[10]).toBe(30);
    expect(params[11]).toBe(10);
  });

  it('returns null when nothing matched (wrong campaign or missing combatant)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CombatantModel.update('cb1', 'other-campaign', {})).toBeNull();
  });
});

describe('CombatantModel.isOwnedByUser', () => {
  it('returns true when the combatant is linked to a character owned by userId in this campaign', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    expect(await CombatantModel.isOwnedByUser('cb1', 'c1', 'u1')).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/JOIN campaigns\.combat_scenes s ON s\.id = c\.combat_scene_id/);
    expect(sql).toMatch(/JOIN character_sheet\.characters ch ON ch\.id = c\.character_id/);
    expect(sql).toMatch(/WHERE c\.id = \$1 AND s\.campaign_id = \$2 AND ch\.user_id = \$3/);
    expect(params).toEqual(['cb1', 'c1', 'u1']);
  });

  it('returns false for an NPC combatant (no character_id to join against)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CombatantModel.isOwnedByUser('cb1', 'c1', 'u1')).toBe(false);
  });

  it('returns false when the combatant belongs to another player', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CombatantModel.isOwnedByUser('cb1', 'c1', 'someone-else')).toBe(false);
  });
});

describe('CombatantModel.remove', () => {
  it('deletes scoped through combat_scenes by campaign_id', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await CombatantModel.remove('cb1', 'c1')).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/USING campaigns\.combat_scenes s/);
    expect(sql).toMatch(/WHERE c\.id = \$1 AND c\.combat_scene_id = s\.id AND s\.campaign_id = \$2/);
    expect(params).toEqual(['cb1', 'c1']);
  });

  it('returns false when nothing matched', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await CombatantModel.remove('cb1', 'other-campaign')).toBe(false);
  });
});

describe('CombatantModel.findNextToAct', () => {
  it('picks the highest-initiative combatant who has not acted yet', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'cb1', initiative: 18 }] });
    const combatant = await CombatantModel.findNextToAct('s1');
    expect(combatant).toEqual({ id: 'cb1', initiative: 18 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE combat_scene_id = \$1 AND has_acted_this_round = false/);
    expect(sql).toMatch(/ORDER BY initiative DESC NULLS LAST/);
    expect(params).toEqual(['s1']);
  });

  it('returns null when everyone has already acted', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CombatantModel.findNextToAct('s1')).toBeNull();
  });
});

describe('CombatantModel.markActed', () => {
  it('flips has_acted_this_round to true', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'cb1', has_acted_this_round: true }] });
    const combatant = await CombatantModel.markActed('cb1');
    expect(combatant).toEqual({ id: 'cb1', has_acted_this_round: true });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/SET has_acted_this_round = true/);
    expect(params).toEqual(['cb1']);
  });
});

describe('CombatantModel.updateHpByCharacterId', () => {
  it('updates health/temp_hp for every combatant linked to this character, regardless of campaign', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'cb1', character_id: 'ch1', health: 12, temp_hp: 3 }, { id: 'cb2', character_id: 'ch1', health: 12, temp_hp: 3 }],
    });
    const combatants = await CombatantModel.updateHpByCharacterId('ch1', { health: 12, temp_hp: 3 });
    expect(combatants).toHaveLength(2);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE character_id = \$1/);
    expect(sql).not.toMatch(/combat_scenes/);
    expect(params).toEqual(['ch1', 12, 3]);
  });

  it('returns an empty array when the character has no combatants anywhere', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CombatantModel.updateHpByCharacterId('ch1', { health: 5 })).toEqual([]);
  });
});
