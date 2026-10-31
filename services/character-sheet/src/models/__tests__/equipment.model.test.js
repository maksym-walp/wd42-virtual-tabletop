jest.mock('../../config/db');

const pool = require('../../config/db');
const EquipmentModel = require('../equipment.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [{ id: 'e1' }] });
});

// A sheet row holds a bare catalog UUID, and the catalogs it can point at are
// four separate tables (items/weapons/armor since the equipment split,
// artifacts since their own service). Miss one arm and every sheet row
// pointing into it silently renders as "(невідоме)".
describe('EquipmentModel catalog resolution', () => {
  it.each([
    ['equipment.items', "'item'::varchar AS type"],
    ['equipment.weapons', "'weapon'::varchar"],
    ['equipment.armor', "'armor'::varchar"],
    ['equipment.artifacts', "'artifact'::varchar"],
  ])('resolves sheet rows against %s', async (table, typeLiteral) => {
    await EquipmentModel.findAll('c1');
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain(`FROM ${table}`);
    expect(sql).toContain(typeLiteral);
  });

  it('joins the catalog on the sheet row id, keeping rows whose entry is gone', async () => {
    await EquipmentModel.findAll('c1');
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LEFT JOIN \([\s\S]+\) ei ON ei\.id = ce\.equipment_id/);
  });

  it('resolves the same four catalogs after a patch, not just on list', async () => {
    await EquipmentModel.patch('c1', 'eq1', { mastered: true });
    const [sql] = pool.query.mock.calls[0];
    for (const table of ['equipment.items', 'equipment.weapons', 'equipment.armor', 'equipment.artifacts']) {
      expect(sql).toContain(`FROM ${table}`);
    }
  });

  // Регресія: прибираючи лічильник освоєності (міграція 115), легко лишити
  // в ORDER BY колонку, якої в таблиці немає — pg тут мокається, тож такий
  // недогляд виявляється лише на справжній БД (було: ce.created_at).
  it('sorts by columns that actually exist on the sheet row', async () => {
    await EquipmentModel.findAll('c1');
    const [sql] = pool.query.mock.calls[0];
    const orderBy = sql.slice(sql.lastIndexOf('ORDER BY'));
    expect(orderBy).toContain('ce.mastered');
    for (const gone of ['ce.mastery_count', 'ce.created_at', 'ce.slot']) {
      expect(orderBy).not.toContain(gone);
    }
  });
});

// Лічильник 0-3 вирізано міграцією 115: освоєність — один прапорець, який
// гравець ставить сам (розділ 4.2 — зброя освоєна після першого успішного
// використання). Кількість кубиків шкоди до нього стосунку не має.
describe('EquipmentModel.patch mastered flag', () => {
  it('leaves mastered untouched when the caller did not send it', async () => {
    await EquipmentModel.patch('c1', 'eq1', { is_equipped: false });
    const params = pool.query.mock.calls[0][1];
    expect(params[2]).toBeNull();
  });

  it('passes an explicit mastered value through', async () => {
    await EquipmentModel.patch('c1', 'eq1', { mastered: true });
    expect(pool.query.mock.calls[0][1][2]).toBe(true);

    pool.query.mockClear();
    await EquipmentModel.patch('c1', 'eq1', { mastered: false });
    expect(pool.query.mock.calls[0][1][2]).toBe(false);
  });
});

describe('EquipmentModel.patch is_equipped mutual exclusivity', () => {
  it('skips the unequip-others query entirely when is_equipped is not provided', async () => {
    await EquipmentModel.patch('c1', 'eq1', { mastered: true });
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1][3]).toBeNull();
  });

  it('runs an unequip-others query before the main update when is_equipped is true', async () => {
    await EquipmentModel.patch('c1', 'eq1', { is_equipped: true });

    expect(pool.query).toHaveBeenCalledTimes(2);
    const [unequipSql, unequipParams] = pool.query.mock.calls[0];
    expect(unequipSql).toMatch(/UPDATE character_sheet\.equipment ce/);
    expect(unequipSql).toMatch(/SET is_equipped = false/);
    expect(unequipSql).toMatch(/ce\.character_id = \$1/);
    expect(unequipSql).toMatch(/ce\.equipment_id <> \$2/);
    expect(unequipSql).toMatch(/ei\.type = 'armor'/);
    expect(unequipSql).toMatch(/EXISTS \(/);
    expect(unequipParams).toEqual(['c1', 'eq1']);

    const [, mainParams] = pool.query.mock.calls[1];
    expect(mainParams[3]).toBe(true);
  });

  it('does not run the unequip-others query when explicitly un-equipping (is_equipped: false)', async () => {
    await EquipmentModel.patch('c1', 'eq1', { is_equipped: false });
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1][3]).toBe(false);
  });
});
