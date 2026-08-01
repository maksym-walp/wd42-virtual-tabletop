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

describe('AbilityModel.findAll scope=community', () => {
  it('replaces the ownership clause with a public/other-user/non-canonical filter', async () => {
    await AbilityModel.findAll('u1', { scope: 'community' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(
      /WHERE a\.is_public = true AND a\.user_id <> \$1 AND NOT \(COALESCE\(cu\.role IN \('admin', 'game_master'\), false\) OR a\.is_canonical\)/
    );
    expect(sql).not.toMatch(/a\.user_id = \$1 OR a\.is_public = true/);
    expect(params).toEqual(['u1']);
  });
});

describe('AbilityModel.findAll limit', () => {
  it('appends a parameterized LIMIT clause when limit is given', async () => {
    await AbilityModel.findAll('u1', { limit: 12 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LIMIT \$2$/);
    expect(params).toEqual(['u1', 12]);
  });

  it('omits the LIMIT clause when limit is not given', async () => {
    await AbilityModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/LIMIT/);
  });
});

describe('AbilityModel.delete', () => {
  it('unlinks the entry from collections in the same statement, since the FK no longer cascades', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({ rows: [] })                 // BEGIN
      .mockResolvedValueOnce({ rows: [] })                 // childQueries snapshot
      .mockResolvedValueOnce({ rows: [{ id: 'a1' }] })     // the delete itself
      .mockResolvedValue({ rows: [] });                    // trash insert + COMMIT

    await expect(AbilityModel.delete('a1', 'u1')).resolves.toBe(true);

    const deleteCall = client.query.mock.calls.map(([sql]) => sql).find((sql) => sql && /DELETE FROM abilities\.entries/.test(sql));
    expect(deleteCall).toMatch(/DELETE FROM abilities\.collection_items WHERE item_id = \$1/);
  });
});
