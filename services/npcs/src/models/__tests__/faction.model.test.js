jest.mock('../../config/db');

const pool = require('../../config/db');
const FactionModel = require('../faction.model');

beforeEach(() => jest.clearAllMocks());

describe('FactionModel members', () => {
  it('addMember upserts the role', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'm1' }] });
    await FactionModel.addMember('f1', 'npc', 'n1', 'Скарбник');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO npcs\.faction_members \(faction_id, member_type, member_id, role\)/);
    expect(sql).toMatch(/ON CONFLICT \(faction_id, member_type, member_id\) DO UPDATE SET role = EXCLUDED\.role/);
    expect(params).toEqual(['f1', 'npc', 'n1', 'Скарбник']);
  });

  it('updateMemberRole targets one membership', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await FactionModel.updateMemberRole('f1', 'character', 'c1', null)).toBeNull();
    expect(pool.query.mock.calls[0][1]).toEqual(['f1', 'character', 'c1', null]);
  });

  it('findMembers resolves NPCs from npcs.npcs and characters from character_sheet', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await FactionModel.findMembers('f1');
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM npcs\.npcs e WHERE e\.id = fm\.member_id/);
    expect(sql).toMatch(/FROM character_sheet\.characters c WHERE c\.id = fm\.member_id/);
  });
});

describe('FactionModel.findMembershipsByNpc', () => {
  it('covers memberships and leaderships, limited to factions the viewer can see', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await FactionModel.findMembershipsByNpc('n1', 'u1', false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LEFT JOIN npcs\.faction_members fm/);
    expect(sql).toMatch(/fl\.npc_entry_id = \$1/);
    expect(sql).toMatch(/\$3::bool OR f\.created_by = \$2 OR f\.is_public = true/);
    expect(params).toEqual(['n1', 'u1', false]);
  });
});
