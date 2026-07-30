jest.mock('../../config/db');

const pool = require('../../config/db');
const EntryEquipmentModel = require('../entry-equipment.model');

beforeEach(() => jest.clearAllMocks());

describe('EntryEquipmentModel.findAllByEntry', () => {
  it('joins the equipment union by entry_id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await EntryEquipmentModel.findAllByEntry('e1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM compendium\.compendium_equipment ce/);
    expect(sql).toMatch(/LEFT JOIN \(/);
    expect(sql).toMatch(/WHERE ce\.entry_id = \$1/);
    expect(params).toEqual(['e1']);
  });
});

describe('EntryEquipmentModel.add', () => {
  it('inserts entry_id/equipment_id, ignoring conflicts', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'link1' }] });
    await EntryEquipmentModel.add('e1', 'eq1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO compendium\.compendium_equipment/);
    expect(sql).toMatch(/ON CONFLICT \(entry_id, equipment_id\) DO NOTHING/);
    expect(params).toEqual(['e1', 'eq1']);
  });
});

describe('EntryEquipmentModel.remove', () => {
  it('reports true/false from rowCount', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await EntryEquipmentModel.remove('e1', 'eq1')).toBe(true);
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await EntryEquipmentModel.remove('e1', 'gone')).toBe(false);
  });
});
