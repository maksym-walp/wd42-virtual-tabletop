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
    });
    expect(combatant).toEqual({ id: 'cb1', name: 'Goblin' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO campaigns\.combatants/);
    expect(params).toEqual(['s1', null, 'Goblin', 12, 14, 7, 3, 'weak', 'a sneaky goblin', true]);
  });

  it('links a character_id when provided and defaults optional fields', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'cb1' }] });
    await CombatantModel.add('s1', { character_id: 'ch1', name: 'Hero' });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['s1', 'ch1', 'Hero', null, null, null, null, null, null, false]);
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
    expect(params).toEqual(['cb1', 'c1', null, null, null, 5, null, null, null, null]);
  });

  it('overwrites is_hidden to false explicitly (not treated as "omitted")', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'cb1', is_hidden: false }] });
    await CombatantModel.update('cb1', 'c1', { is_hidden: false });
    const [, params] = pool.query.mock.calls[0];
    expect(params[9]).toBe(false);
  });

  it('returns null when nothing matched (wrong campaign or missing combatant)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CombatantModel.update('cb1', 'other-campaign', {})).toBeNull();
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
