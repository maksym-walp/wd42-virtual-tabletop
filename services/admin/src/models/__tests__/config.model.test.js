jest.mock('../../config/db');

const pool = require('../../config/db');
const ConfigModel = require('../config.model');

beforeEach(() => jest.clearAllMocks());

describe('ConfigModel.findAll', () => {
  it('selects all configs ordered by key', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ key: 'weapon_types', value: [] }] });
    const rows = await ConfigModel.findAll();
    expect(pool.query.mock.calls[0][0]).toMatch(/SELECT key, value, updated_at FROM admin\.site_configs ORDER BY key/);
    expect(rows).toEqual([{ key: 'weapon_types', value: [] }]);
  });
});

describe('ConfigModel.findByKey', () => {
  it('returns null when missing', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await ConfigModel.findByKey('nope')).toBeNull();
  });

  it('returns the row when found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ key: 'weapon_types', value: [] }] });
    const config = await ConfigModel.findByKey('weapon_types');
    expect(pool.query.mock.calls[0][1]).toEqual(['weapon_types']);
    expect(config).toEqual({ key: 'weapon_types', value: [] });
  });
});

describe('ConfigModel.upsert', () => {
  it('inserts with ON CONFLICT DO UPDATE, serializing value to JSON', async () => {
    const value = [{ key: 'melee', label: 'Ближня' }];
    pool.query.mockResolvedValueOnce({ rows: [{ key: 'weapon_types', value }] });
    await ConfigModel.upsert('weapon_types', value);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO admin\.site_configs/);
    expect(sql).toMatch(/ON CONFLICT \(key\) DO UPDATE SET value = \$2/);
    expect(params).toEqual(['weapon_types', JSON.stringify(value)]);
  });
});
