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

describe('ManeuverModel.findAll scope=community', () => {
  it('replaces the ownership clause with a public/other-user/non-admin filter', async () => {
    await ManeuverModel.findAll('u1', { scope: 'community' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE m\.is_public = true AND m\.user_id <> \$1 AND cu\.role IS DISTINCT FROM 'admin'/);
    expect(sql).not.toMatch(/m\.user_id = \$1 OR m\.is_public = true/);
    expect(params).toEqual(['u1']);
  });
});

describe('ManeuverModel.findAll limit', () => {
  it('appends a parameterized LIMIT clause when limit is given', async () => {
    await ManeuverModel.findAll('u1', { limit: 12 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LIMIT \$2$/);
    expect(params).toEqual(['u1', 12]);
  });

  it('omits the LIMIT clause when limit is not given', async () => {
    await ManeuverModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/LIMIT/);
  });
});
