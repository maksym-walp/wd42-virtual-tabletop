jest.mock('../../config/db');

const pool = require('../../config/db');
const NephilimBreakthroughModel = require('../nephilim-breakthrough.model');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('NephilimBreakthroughModel.findAll', () => {
  it('maps rows to a flat array of node_id', async () => {
    pool.query.mockResolvedValue({ rows: [{ node_id: 'n1' }, { node_id: 'n2' }] });

    const result = await NephilimBreakthroughModel.findAll('c1');

    expect(result).toEqual(['n1', 'n2']);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/character_sheet\.nephilim_breakthroughs/);
    expect(params).toEqual(['c1']);
  });
});

describe('NephilimBreakthroughModel.use', () => {
  it('returns the node_id when the insert succeeds', async () => {
    pool.query.mockResolvedValue({ rows: [{ node_id: 'n1' }] });

    const result = await NephilimBreakthroughModel.use('c1', 'n1');

    expect(result).toBe('n1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO character_sheet\.nephilim_breakthroughs/);
    expect(sql).toMatch(/ON CONFLICT/);
    expect(sql).toMatch(/DO NOTHING/);
    expect(params).toEqual(['c1', 'n1']);
  });

  it('returns null when the row already existed (conflict, no row returned)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await NephilimBreakthroughModel.use('c1', 'n1');

    expect(result).toBeNull();
  });
});

describe('NephilimBreakthroughModel.revoke', () => {
  it('returns true when a row was deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });

    const result = await NephilimBreakthroughModel.revoke('c1', 'n1');

    expect(result).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM character_sheet\.nephilim_breakthroughs/);
    expect(params).toEqual(['c1', 'n1']);
  });

  it('returns false when nothing was deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 0 });

    const result = await NephilimBreakthroughModel.revoke('c1', 'n1');

    expect(result).toBe(false);
  });
});

describe('NephilimBreakthroughModel.countUnlocked', () => {
  it('counts unlocked tree_progress rows (not breakthroughs used) and parses the count', async () => {
    pool.query.mockResolvedValue({ rows: [{ cnt: '5' }] });

    const result = await NephilimBreakthroughModel.countUnlocked('c1');

    expect(result).toBe(5);
    const [sql, params] = pool.query.mock.calls[0];
    // The allowance is driven by how many skill-tree nodes are unlocked overall,
    // not by how many breakthroughs have already been used.
    expect(sql).toMatch(/character_sheet\.tree_progress/);
    expect(sql).not.toMatch(/nephilim_breakthroughs/);
    expect(params).toEqual(['c1']);
  });
});
