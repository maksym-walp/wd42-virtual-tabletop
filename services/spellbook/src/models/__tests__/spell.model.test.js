jest.mock('../../config/db');

const pool = require('../../config/db');
const SpellModel = require('../spell.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('SpellModel.findAll sort whitelist', () => {
  it('defaults to sorting by name when sort is omitted', async () => {
    await SpellModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY s\.name ASC/);
  });

  it('falls back to name for an unrecognized sort value', async () => {
    await SpellModel.findAll('u1', { sort: "'; DROP TABLE spells; --" });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY s\.name ASC/);
  });

  it('uses the mapped ORDER BY for a recognized sort key', async () => {
    await SpellModel.findAll('u1', { sort: 'energy_cost' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY s\.energy_cost ASC, s\.name ASC/);
  });
});

describe('SpellModel.findAll dynamic filter builder', () => {
  it('has only the ownership condition when no filters are given', async () => {
    await SpellModel.findAll('u1', {});
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE \(s\.user_id = \$1 OR s\.is_public = true\)/);
    expect(params).toEqual(['u1']);
  });

  it('adds a parameterized condition per active filter, in order', async () => {
    await SpellModel.findAll('u1', { magicType: 'fire', spellKind: 'attack', ritual: 'possible', search: 'bolt' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/s\.magic_type = \$2/);
    expect(sql).toMatch(/s\.spell_kind = \$3/);
    expect(sql).toMatch(/s\.ritual = \$4/);
    expect(sql).toMatch(/s\.name ILIKE \$5/);
    expect(params).toEqual(['u1', 'fire', 'attack', 'possible', '%bolt%']);
  });
});

describe('SpellModel.findAll scope=community', () => {
  it('replaces the ownership clause with a public/other-user/non-admin filter', async () => {
    await SpellModel.findAll('u1', { scope: 'community' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE s\.is_public = true AND s\.user_id <> \$1 AND cu\.role IS DISTINCT FROM 'admin'/);
    expect(sql).not.toMatch(/s\.user_id = \$1 OR s\.is_public = true/);
    expect(params).toEqual(['u1']);
  });
});

describe('SpellModel.findAll limit', () => {
  it('appends a parameterized LIMIT clause when limit is given', async () => {
    await SpellModel.findAll('u1', { limit: 12 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LIMIT \$2$/);
    expect(params).toEqual(['u1', 12]);
  });

  it('omits the LIMIT clause when limit is not given', async () => {
    await SpellModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/LIMIT/);
  });
});
