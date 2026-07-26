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
    ['artifacts.entries', "'artifact'::varchar"],
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

  it('resolves the same four catalogs after a mastery patch, not just on list', async () => {
    await EquipmentModel.patch('c1', 'eq1', { mastery_count: 1 });
    const [sql] = pool.query.mock.calls[0];
    for (const table of ['equipment.items', 'equipment.weapons', 'equipment.armor', 'artifacts.entries']) {
      expect(sql).toContain(`FROM ${table}`);
    }
  });
});

describe('EquipmentModel.patch auto-mastery rule', () => {
  it('does not force mastery below the 3-use threshold', async () => {
    await EquipmentModel.patch('c1', 'eq1', { mastery_count: 2 });
    const params = pool.query.mock.calls[0][1];
    expect(params[3]).toBeNull();
  });

  it('auto-masters once mastery_count reaches 3', async () => {
    await EquipmentModel.patch('c1', 'eq1', { mastery_count: 3 });
    const params = pool.query.mock.calls[0][1];
    expect(params[3]).toBe(true);
  });

  it('lets an explicit mastered value override the auto-rule', async () => {
    await EquipmentModel.patch('c1', 'eq1', { mastery_count: 5, mastered: false });
    const params = pool.query.mock.calls[0][1];
    expect(params[3]).toBe(false);
  });
});
