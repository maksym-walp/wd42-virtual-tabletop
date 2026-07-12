jest.mock('../../config/db');

const pool = require('../../config/db');
const SpellProgressModel = require('../spell.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [{ id: 's1' }] });
});

describe('SpellProgressModel.patch auto-mastery rule', () => {
  it('does not force mastery below 3 casts', async () => {
    await SpellProgressModel.patch('c1', 's1', { cast_count: 2 });
    const params = pool.query.mock.calls[0][1];
    expect(params[2]).toBeNull();
  });

  it('auto-masters once cast_count reaches 3', async () => {
    await SpellProgressModel.patch('c1', 's1', { cast_count: 3 });
    const params = pool.query.mock.calls[0][1];
    expect(params[2]).toBe(true);
  });

  it('lets an explicit mastered value override the auto-rule', async () => {
    await SpellProgressModel.patch('c1', 's1', { cast_count: 10, mastered: false });
    const params = pool.query.mock.calls[0][1];
    expect(params[2]).toBe(false);
  });
});
