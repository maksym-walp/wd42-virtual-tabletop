jest.mock('../../config/db');

const pool = require('../../config/db');
const EdgeModel = require('../edge.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('EdgeModel.findAll WHERE builder', () => {
  it('queries all edges with no join when archetype is absent', async () => {
    await EdgeModel.findAll({});
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/JOIN/);
    expect(params).toBeUndefined();
  });

  it('joins on nodes and filters by archetype when provided', async () => {
    await EdgeModel.findAll({ archetype: 'mage' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/JOIN skill_tree\.nodes/);
    expect(params).toEqual(['mage']);
  });
});
