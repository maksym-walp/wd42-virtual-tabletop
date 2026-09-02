jest.mock('../../config/db');

const pool = require('../../config/db');
const NodeModel = require('../node.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('NodeModel.findAll WHERE builder', () => {
  it('has no archetype filter and no params when archetype is absent', async () => {
    await NodeModel.findAll({});
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/WHERE n\.archetype/);
    expect(params).toEqual([]);
  });

  it('adds an archetype filter with the param when provided', async () => {
    await NodeModel.findAll({ archetype: 'warrior' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE n\.archetype = \$1/);
    expect(params).toEqual(['warrior']);
  });

  it('always aggregates linked grants', async () => {
    await NodeModel.findAll({});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/node_grants/);
    expect(sql).toMatch(/AS grants/);
  });
});
