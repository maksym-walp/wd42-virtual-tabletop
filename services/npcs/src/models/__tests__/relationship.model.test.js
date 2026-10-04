jest.mock('../../config/db');

const pool = require('../../config/db');
const RelationshipModel = require('../relationship.model');

beforeEach(() => jest.clearAllMocks());

describe('RelationshipModel.findOutgoing', () => {
  it('resolves NPC and character targets, each filtered by viewer visibility', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await RelationshipModel.findOutgoing('n1', 'u1', false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM npcs\.npcs n[\s\S]*r\.target_type = 'npc'[\s\S]*\$3::bool OR n\.created_by = \$2 OR n\.is_public = true/);
    expect(sql).toMatch(/FROM character_sheet\.characters c[\s\S]*\$3::bool OR c\.user_id = \$2 OR c\.is_public = true/);
    expect(sql).toMatch(/WHERE r\.npc_id = \$1/);
    expect(params).toEqual(['n1', 'u1', false]);
  });
});

describe('RelationshipModel.findIncoming', () => {
  it('lists visible NPCs that point at this NPC', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await RelationshipModel.findIncoming('n1', 'u1', true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/r\.target_type = 'npc' AND r\.target_id = \$1/);
    expect(params).toEqual(['n1', 'u1', true]);
  });
});

describe('RelationshipModel writes', () => {
  it('create ignores a duplicate target', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await RelationshipModel.create('n1', { targetType: 'npc', targetId: 'n2', label: 'брат' })).toBeNull();
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ON CONFLICT \(npc_id, target_type, target_id\) DO NOTHING/);
    expect(params).toEqual(['n1', 'npc', 'n2', 'брат', null]);
  });

  it('update/remove are scoped to the owning NPC', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'r1' }] }).mockResolvedValueOnce({ rowCount: 0 });
    await RelationshipModel.update('n1', 'r1', { label: 'ворог', note: 'давно' });
    expect(pool.query.mock.calls[0][0]).toMatch(/WHERE id = \$2 AND npc_id = \$1/);
    expect(pool.query.mock.calls[0][1]).toEqual(['n1', 'r1', 'ворог', 'давно']);
    expect(await RelationshipModel.remove('n1', 'r1')).toBe(false);
    expect(pool.query.mock.calls[1][0]).toMatch(/DELETE FROM npcs\.npc_relationships WHERE id = \$2 AND npc_id = \$1/);
  });
});
