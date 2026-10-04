jest.mock('../../config/db');

const pool = require('../../config/db');
const { buildRelationModels } = require('../relations.model');

const { EquipmentModel, SpellModel, AbilityModel } = buildRelationModels('bestiary', 'creature');

beforeEach(() => jest.clearAllMocks());

describe('relation models built for a schema/prefix', () => {
  it('equipment reads its junction table and resolves against the equipment union', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await EquipmentModel.findAllByEntry('c1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM bestiary\.creature_equipment r/);
    expect(sql).toMatch(/FROM equipment\.items/);
    expect(sql).toMatch(/x\.id = r\.equipment_id/);
    expect(sql).toMatch(/WHERE r\.creature_id = \$1/);
    expect(sql).toMatch(/AS equipment/);
    expect(params).toEqual(['c1']);
  });

  it('spells join spellbook.spells', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await SpellModel.findAllByEntry('c1');
    expect(pool.query.mock.calls[0][0]).toMatch(/LEFT JOIN spellbook\.spells x ON x\.id = r\.spell_id/);
  });

  it('abilities add is idempotent on the unique pair', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const result = await AbilityModel.add('c1', 'ab1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO bestiary\.creature_abilities \(creature_id, ability_id\)/);
    expect(sql).toMatch(/ON CONFLICT \(creature_id, ability_id\) DO NOTHING/);
    expect(params).toEqual(['c1', 'ab1']);
    expect(result).toBeNull();
  });

  it('remove reports whether a row went away', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await SpellModel.remove('c1', 'sp1')).toBe(true);
    expect(pool.query.mock.calls[0][0]).toMatch(/DELETE FROM bestiary\.creature_spells WHERE creature_id = \$1 AND spell_id = \$2/);
  });
});

describe('a different schema/prefix', () => {
  it('npcs.npc_equipment with an npc_id parent column', async () => {
    const { EquipmentModel: NpcEquipment } = buildRelationModels('npcs', 'npc');
    pool.query.mockResolvedValueOnce({ rows: [] });
    await NpcEquipment.findAllByEntry('n1');
    expect(pool.query.mock.calls[0][0]).toMatch(/FROM npcs\.npc_equipment r[\s\S]*WHERE r\.npc_id = \$1/);
  });
});
