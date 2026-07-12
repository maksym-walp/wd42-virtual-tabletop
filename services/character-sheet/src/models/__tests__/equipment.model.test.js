jest.mock('../../config/db');

const pool = require('../../config/db');
const EquipmentModel = require('../equipment.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [{ id: 'e1' }] });
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
