jest.mock('../../config/db');

const pool = require('../../config/db');
const AbilityModel = require('../ability.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('AbilityModel.findAll sort whitelist', () => {
  it('defaults to sorting by name when sort is omitted', async () => {
    await AbilityModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY a\.name ASC/);
  });

  it('falls back to name for an unrecognized sort value', async () => {
    await AbilityModel.findAll('u1', { sort: "'; DROP TABLE entries; --" });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY a\.name ASC/);
  });
});

describe('AbilityModel.findAll dynamic filter builder', () => {
  it('has only the ownership condition when no filters are given', async () => {
    await AbilityModel.findAll('u1', {});
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE \(a\.user_id = \$1 OR a\.is_public = true\)/);
    expect(params).toEqual(['u1']);
  });

  it('adds a parameterized condition per active filter, in order', async () => {
    await AbilityModel.findAll('u1', { search: 'парирування', archetype: 'rogue' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/a\.name ILIKE \$2/);
    expect(sql).toMatch(/\$3 = ANY\(a\.archetypes\)/);
    expect(params).toEqual(['u1', '%парирування%', 'rogue']);
  });
});
