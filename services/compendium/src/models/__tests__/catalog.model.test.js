jest.mock('../../config/db');

const pool = require('../../config/db');
const { isVisibleToUser, isEquipmentVisibleToUser } = require('../catalog.model');

beforeEach(() => jest.clearAllMocks());

describe('isVisibleToUser', () => {
  it('true when owned or public', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    expect(await isVisibleToUser('spellbook.spells', 'sp1', 'u1')).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM spellbook\.spells/);
    expect(sql).toMatch(/user_id = \$2 OR is_public = true/);
    expect(params).toEqual(['sp1', 'u1']);
  });

  it('false when neither owned nor public', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await isVisibleToUser('spellbook.spells', 'sp1', 'u1')).toBe(false);
  });
});

describe('isEquipmentVisibleToUser', () => {
  it('checks items, then weapons, then armor, stopping at the first hit', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // items: no
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }); // weapons: yes
    expect(await isEquipmentVisibleToUser('w1', 'u1')).toBe(true);
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls[0][0]).toMatch(/equipment\.items/);
    expect(pool.query.mock.calls[1][0]).toMatch(/equipment\.weapons/);
  });

  it('false when not visible in any of the three tables', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    expect(await isEquipmentVisibleToUser('gone', 'u1')).toBe(false);
    expect(pool.query).toHaveBeenCalledTimes(3);
  });
});
