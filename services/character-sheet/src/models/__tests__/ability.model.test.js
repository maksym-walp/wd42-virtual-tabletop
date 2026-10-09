jest.mock('../../config/db');

const pool = require('../../config/db');
const AbilityModel = require('../ability.model');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AbilityModel.add', () => {
  it('inserts a character/ability reference row', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'a1', character_id: 'c1', ability_id: 'ab1' }] });
    const result = await AbilityModel.add('c1', 'ab1');
    expect(result).toEqual({ id: 'a1', character_id: 'c1', ability_id: 'ab1' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ON CONFLICT \(character_id, ability_id\) DO NOTHING/);
    expect(params).toEqual(['c1', 'ab1', null, 'main', ['main']]);
  });

  it('stores the given form progress', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await AbilityModel.add('c1', 'ab1', { form_tier: 'perfected', primary_form: 'main', mastered_forms: ['main'] });
    expect(pool.query.mock.calls[0][1]).toEqual(['c1', 'ab1', 'perfected', 'main', ['main']]);
  });

  it('returns null when the character already has the ability (ON CONFLICT DO NOTHING)', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const result = await AbilityModel.add('c1', 'ab1');
    expect(result).toBeNull();
  });
});

describe('AbilityModel.remove', () => {
  it('returns true when a row was deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });
    const result = await AbilityModel.remove('c1', 'ab1');
    expect(result).toBe(true);
  });

  it('returns false when nothing matched', async () => {
    pool.query.mockResolvedValue({ rowCount: 0 });
    const result = await AbilityModel.remove('c1', 'ab1');
    expect(result).toBe(false);
  });
});
