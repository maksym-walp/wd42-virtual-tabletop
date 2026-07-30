jest.mock('../../config/db');

const pool = require('../../config/db');
const EntrySpellModel = require('../entry-spell.model');

beforeEach(() => jest.clearAllMocks());

describe('EntrySpellModel.findAllByEntry', () => {
  it('joins spellbook.spells by entry_id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await EntrySpellModel.findAllByEntry('e1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM compendium\.compendium_spells cs/);
    expect(sql).toMatch(/LEFT JOIN spellbook\.spells sp/);
    expect(sql).toMatch(/WHERE cs\.entry_id = \$1/);
    expect(params).toEqual(['e1']);
  });
});

describe('EntrySpellModel.add', () => {
  it('inserts entry_id/spell_id, ignoring conflicts', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'link1' }] });
    await EntrySpellModel.add('e1', 'sp1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO compendium\.compendium_spells/);
    expect(sql).toMatch(/ON CONFLICT \(entry_id, spell_id\) DO NOTHING/);
    expect(params).toEqual(['e1', 'sp1']);
  });
});

describe('EntrySpellModel.remove', () => {
  it('reports true/false from rowCount', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await EntrySpellModel.remove('e1', 'sp1')).toBe(true);
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await EntrySpellModel.remove('e1', 'gone')).toBe(false);
  });
});
