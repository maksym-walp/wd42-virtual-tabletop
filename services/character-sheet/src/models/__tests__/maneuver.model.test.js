jest.mock('../../config/db');

const pool = require('../../config/db');
const ManeuverModel = require('../maneuver.model');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ManeuverModel.add', () => {
  it('inserts a character/maneuver reference row', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'm1', character_id: 'c1', maneuver_id: 'mv1' }] });
    const result = await ManeuverModel.add('c1', 'mv1');
    expect(result).toEqual({ id: 'm1', character_id: 'c1', maneuver_id: 'mv1' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ON CONFLICT \(character_id, maneuver_id\) DO NOTHING/);
    expect(params).toEqual(['c1', 'mv1']);
  });

  it('returns null when the character already knows the maneuver (ON CONFLICT DO NOTHING)', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const result = await ManeuverModel.add('c1', 'mv1');
    expect(result).toBeNull();
  });
});

describe('ManeuverModel.remove', () => {
  it('returns true when a row was deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });
    const result = await ManeuverModel.remove('c1', 'mv1');
    expect(result).toBe(true);
  });

  it('returns false when nothing matched', async () => {
    pool.query.mockResolvedValue({ rowCount: 0 });
    const result = await ManeuverModel.remove('c1', 'mv1');
    expect(result).toBe(false);
  });
});
