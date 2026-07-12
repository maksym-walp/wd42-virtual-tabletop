jest.mock('../../config/db');

const pool = require('../../config/db');
const ManeuverModel = require('../maneuver.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('ManeuverModel.findAll sort whitelist', () => {
  it('defaults to sorting by name when sort is omitted', async () => {
    await ManeuverModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY m\.name ASC/);
  });

  it('falls back to name for an unrecognized sort value', async () => {
    await ManeuverModel.findAll('u1', { sort: "'; DROP TABLE entries; --" });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY m\.name ASC/);
  });

  it('uses the mapped ORDER BY for a recognized sort key', async () => {
    await ManeuverModel.findAll('u1', { sort: 'duration_actions' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY m\.duration_actions ASC, m\.name ASC/);
  });
});

describe('ManeuverModel.findAll dynamic filter builder', () => {
  it('has only the ownership condition when no filters are given', async () => {
    await ManeuverModel.findAll('u1', {});
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE \(m\.user_id = \$1 OR m\.is_public = true\)/);
    expect(params).toEqual(['u1']);
  });

  it('adds a parameterized condition per active filter, in order', async () => {
    await ManeuverModel.findAll('u1', { search: 'парирування' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/m\.name ILIKE \$2/);
    expect(params).toEqual(['u1', '%парирування%']);
  });
});
