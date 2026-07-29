jest.mock('../../config/db');

const pool = require('../../config/db');
const CombatSceneModel = require('../combat-scene.model');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CombatSceneModel.create', () => {
  it('inserts the scene against the campaign and returns the row', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 's1', campaign_id: 'c1', round_number: 1 }] });
    const scene = await CombatSceneModel.create('c1', { image_url: '/uploads/bg.jpg' });
    expect(scene).toEqual({ id: 's1', campaign_id: 'c1', round_number: 1 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO campaigns\.combat_scenes/);
    expect(params).toEqual(['c1', '/uploads/bg.jpg']);
  });

  it('defaults image_url to null when omitted', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 's1' }] });
    await CombatSceneModel.create('c1', {});
    expect(pool.query.mock.calls[0][1]).toEqual(['c1', null]);
  });
});

describe('CombatSceneModel.findCurrentByCampaign', () => {
  it('returns the most recently created scene for the campaign', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 's2' }] });
    const scene = await CombatSceneModel.findCurrentByCampaign('c1');
    expect(scene).toEqual({ id: 's2' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY created_at DESC/);
    expect(sql).toMatch(/LIMIT 1/);
    expect(params).toEqual(['c1']);
  });

  it('returns null when the campaign has no scenes', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CombatSceneModel.findCurrentByCampaign('c1')).toBeNull();
  });
});

describe('CombatSceneModel.findById', () => {
  it('scopes the lookup by campaign_id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 's1', campaign_id: 'c1' }] });
    const scene = await CombatSceneModel.findById('s1', 'c1');
    expect(scene).toEqual({ id: 's1', campaign_id: 'c1' });
    expect(pool.query.mock.calls[0][1]).toEqual(['s1', 'c1']);
  });

  it('returns null when not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CombatSceneModel.findById('s1', 'c1')).toBeNull();
  });
});

describe('CombatSceneModel.update', () => {
  it('updates only the provided fields, scoped by campaign', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 's1', image_url: '/bg.jpg' }] });
    const scene = await CombatSceneModel.update('s1', 'c1', { image_url: '/bg.jpg' });
    expect(scene).toEqual({ id: 's1', image_url: '/bg.jpg' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND campaign_id = \$2/);
    expect(params).toEqual(['s1', 'c1', '/bg.jpg', null]);
  });

  it('returns null when nothing matched', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CombatSceneModel.update('s1', 'other-campaign', {})).toBeNull();
  });
});

describe('CombatSceneModel.advanceRound', () => {
  it('increments round_number and resets every combatant turn flag', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 's1', round_number: 2 }] })
      .mockResolvedValueOnce({ rowCount: 3 });

    const scene = await CombatSceneModel.advanceRound('s1', 'c1');

    expect(scene).toEqual({ id: 's1', round_number: 2 });
    expect(pool.query).toHaveBeenCalledTimes(2);
    const [sceneSql, sceneParams] = pool.query.mock.calls[0];
    expect(sceneSql).toMatch(/SET round_number = round_number \+ 1/);
    expect(sceneParams).toEqual(['s1', 'c1']);
    const [combatantsSql, combatantsParams] = pool.query.mock.calls[1];
    expect(combatantsSql).toMatch(/SET has_acted_this_round = false/);
    expect(combatantsParams).toEqual(['s1']);
  });

  it('does not touch combatants when the scene was not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const scene = await CombatSceneModel.advanceRound('s1', 'other-campaign');
    expect(scene).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe('CombatSceneModel.remove', () => {
  it('deletes the scene scoped by campaign_id and returns true when removed', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await CombatSceneModel.remove('s1', 'c1')).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND campaign_id = \$2/);
    expect(params).toEqual(['s1', 'c1']);
  });

  it('returns false when nothing matched', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await CombatSceneModel.remove('s1', 'other-campaign')).toBe(false);
  });
});
