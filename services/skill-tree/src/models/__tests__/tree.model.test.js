jest.mock('../../config/db');

const pool = require('../../config/db');
const TreeModel = require('../tree.model');

let client;

beforeEach(() => {
  jest.clearAllMocks();
  client = { query: jest.fn(), release: jest.fn() };
  pool.connect.mockResolvedValue(client);
});

describe('TreeModel.importTree', () => {
  it('wipes, reinserts nodes/edges and commits on success', async () => {
    client.query.mockImplementation((sql) => {
      if (sql.includes('INSERT INTO skill_tree.nodes')) {
        return Promise.resolve({ rows: [{ id: 'n1' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    await TreeModel.importTree(
      [{ id: 'n1', title: 'Root' }],
      [{ source_id: 'n1', target_id: 'n1' }], // self-loop, should be skipped
      'fighter'
    );

    const sqlSequence = client.query.mock.calls.map(([sql]) => sql);
    expect(sqlSequence[0]).toBe('BEGIN');
    expect(sqlSequence.some((sql) => sql.includes('DELETE FROM skill_tree.nodes WHERE archetype = $1'))).toBe(true);
    const deleteCall = client.query.mock.calls.find(([sql]) => sql.includes('DELETE FROM skill_tree.nodes'));
    expect(deleteCall[1]).toEqual(['fighter']);
    expect(sqlSequence[sqlSequence.length - 1]).toBe('COMMIT');
    // self-referencing edge (src === dst) must not be inserted
    expect(sqlSequence.some((sql) => sql.includes('INSERT INTO skill_tree.edges'))).toBe(false);
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back and rethrows on failure', async () => {
    client.query.mockImplementation((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return Promise.resolve();
      if (sql.includes('DELETE FROM skill_tree.nodes')) return Promise.reject(new Error('boom'));
      return Promise.resolve({ rows: [] });
    });

    await expect(TreeModel.importTree([], [], 'fighter')).rejects.toThrow('boom');

    const sqlSequence = client.query.mock.calls.map(([sql]) => sql);
    expect(sqlSequence).toContain('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});
