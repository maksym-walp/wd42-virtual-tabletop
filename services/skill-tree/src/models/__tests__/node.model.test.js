jest.mock('../../config/db');

const pool = require('../../config/db');
const NodeModel = require('../node.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('NodeModel.findAll WHERE builder', () => {
  it('has no WHERE clause and no params when archetype is absent', async () => {
    await NodeModel.findAll({});
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/WHERE/);
    expect(params).toEqual([]);
  });

  it('adds a WHERE clause with the archetype param when provided', async () => {
    await NodeModel.findAll({ archetype: 'warrior' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE archetype = \$1/);
    expect(params).toEqual(['warrior']);
  });
});
