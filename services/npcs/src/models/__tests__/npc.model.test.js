jest.mock('../../config/db');

const pool = require('../../config/db');
const NpcModel = require('../npc.model');

const ATTRS = { dexterity: 3, body: 4, intelligence: 2, wisdom: 5, charisma: 1 };

beforeEach(() => jest.clearAllMocks());

describe('NpcModel reads', () => {
  it('resolves the health die override -> subspecies -> species -> d6', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'n1' }] });
    await NpcModel.findById('n1', 'u1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/COALESCE\(n\.health_die_override, sub\.health_die, sp\.health_die, 'd6'\)/);
    expect(sql).toMatch(/FROM npcs\.npcs n/);
    expect(sql).toMatch(/LEFT JOIN compendium\.species sp ON sp\.id = n\.species_id/);
    expect(params).toEqual(['n1', 'u1']);
  });
});

describe('NpcModel.create', () => {
  it('writes death date columns alongside the birth date', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'n1' }] });
    await NpcModel.create({
      createdBy: 'u1', name: 'Tom', attributes: ATTRS,
      birthCalendarId: 'cal', birthYear: 1, birthMonthId: 'm1', birthDay: 2,
      deathCalendarId: 'cal', deathYear: 90, deathMonthId: 'm3', deathDay: 4,
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO npcs\.npcs \(created_by, name, species_id/);
    expect(sql).toMatch(/death_calendar_id, death_year, death_month_id, death_day/);
    expect(sql).toMatch(/\$29::jsonb/);
    expect(params).toHaveLength(29);
    expect(params.slice(18, 26)).toEqual(['cal', 1, 'm1', 2, 'cal', 90, 'm3', 4]);
  });
});

describe('NpcModel.remove', () => {
  it('also drops polymorphic faction memberships and relationships pointing at the NPC', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await NpcModel.remove('n1')).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM npcs\.faction_members WHERE member_type = 'npc' AND member_id = \$1/);
    expect(sql).toMatch(/DELETE FROM npcs\.npc_relationships WHERE target_type = 'npc' AND target_id = \$1/);
    expect(sql).toMatch(/DELETE FROM npcs\.npcs WHERE id = \$1/);
    expect(params).toEqual(['n1']);
  });
});

describe('NpcModel.updateRolledHealth', () => {
  it('touches only rolled_health', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'n1' }] });
    await NpcModel.updateRolledHealth('n1', 42);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/SET rolled_health = \$2, updated_at = NOW\(\)/);
    expect(params).toEqual(['n1', 42]);
  });
});
