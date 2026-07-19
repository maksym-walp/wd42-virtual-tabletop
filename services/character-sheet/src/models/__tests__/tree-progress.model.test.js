jest.mock('../../config/db');

const pool = require('../../config/db');
const TreeProgressModel = require('../tree-progress.model');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TreeProgressModel.findAll', () => {
  it('returns all unlocked nodes for the character', async () => {
    const rows = [{ node_id: 'n1' }, { node_id: 'n2' }];
    pool.query.mockResolvedValue({ rows });

    const result = await TreeProgressModel.findAll('c1');

    expect(result).toBe(rows);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/character_sheet\.tree_progress/);
    expect(params).toEqual(['c1']);
  });
});

describe('TreeProgressModel.unlock', () => {
  it('returns the new row on a fresh unlock', async () => {
    const row = { id: 'p1', character_id: 'c1', node_id: 'n1' };
    pool.query.mockResolvedValue({ rows: [row] });

    const result = await TreeProgressModel.unlock('c1', 'n1');

    expect(result).toBe(row);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO character_sheet\.tree_progress/);
    expect(sql).toMatch(/ON CONFLICT/);
    expect(sql).toMatch(/DO NOTHING/);
    expect(params).toEqual(['c1', 'n1']);
  });

  it('returns null when the node was already unlocked (conflict, no row returned)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await TreeProgressModel.unlock('c1', 'n1');

    expect(result).toBeNull();
  });
});

describe('TreeProgressModel.lock', () => {
  it('returns true when a row was deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });

    const result = await TreeProgressModel.lock('c1', 'n1');

    expect(result).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM character_sheet\.tree_progress/);
    expect(params).toEqual(['c1', 'n1']);
  });

  it('returns false when the node was not unlocked', async () => {
    pool.query.mockResolvedValue({ rowCount: 0 });

    const result = await TreeProgressModel.lock('c1', 'n1');

    expect(result).toBe(false);
  });
});
