jest.mock('../../config/db');

const pool = require('../../config/db');
const EntryManeuverModel = require('../entry-maneuver.model');

beforeEach(() => jest.clearAllMocks());

describe('EntryManeuverModel.findAllByEntry', () => {
  it('joins maneuvers.entries by entry_id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await EntryManeuverModel.findAllByEntry('e1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM compendium\.compendium_maneuvers cm/);
    expect(sql).toMatch(/LEFT JOIN maneuvers\.entries me/);
    expect(sql).toMatch(/WHERE cm\.entry_id = \$1/);
    expect(params).toEqual(['e1']);
  });
});

describe('EntryManeuverModel.add', () => {
  it('inserts entry_id/maneuver_id, ignoring conflicts', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'link1' }] });
    await EntryManeuverModel.add('e1', 'mn1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO compendium\.compendium_maneuvers/);
    expect(sql).toMatch(/ON CONFLICT \(entry_id, maneuver_id\) DO NOTHING/);
    expect(params).toEqual(['e1', 'mn1']);
  });
});

describe('EntryManeuverModel.remove', () => {
  it('reports true/false from rowCount', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await EntryManeuverModel.remove('e1', 'mn1')).toBe(true);
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await EntryManeuverModel.remove('e1', 'gone')).toBe(false);
  });
});
