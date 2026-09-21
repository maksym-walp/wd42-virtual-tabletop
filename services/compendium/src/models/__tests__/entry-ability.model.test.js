jest.mock('../../config/db');

const pool = require('../../config/db');
const EntryAbilityModel = require('../entry-ability.model');

beforeEach(() => jest.clearAllMocks());

describe('EntryAbilityModel.findAllByEntry', () => {
  it('joins abilities.entries by entry_id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await EntryAbilityModel.findAllByEntry('e1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM compendium\.compendium_abilities ca/);
    expect(sql).toMatch(/LEFT JOIN abilities\.entries ae/);
    expect(sql).toMatch(/WHERE ca\.entry_id = \$1/);
    expect(params).toEqual(['e1']);
  });
});

describe('EntryAbilityModel.add', () => {
  it('inserts entry_id/ability_id, ignoring conflicts', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'link1' }] });
    await EntryAbilityModel.add('e1', 'ab1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO compendium\.compendium_abilities/);
    expect(sql).toMatch(/ON CONFLICT \(entry_id, ability_id\) DO NOTHING/);
    expect(params).toEqual(['e1', 'ab1']);
  });
});

describe('EntryAbilityModel.remove', () => {
  it('reports true/false from rowCount', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await EntryAbilityModel.remove('e1', 'ab1')).toBe(true);
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await EntryAbilityModel.remove('e1', 'gone')).toBe(false);
  });
});
