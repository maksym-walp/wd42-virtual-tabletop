jest.mock('../../config/db');

const pool = require('../../config/db');
const NodeGrantModel = require('../node-grant.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('NodeGrantModel.replaceForNode', () => {
  it('deletes existing grants then inserts the sanitized list', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await NodeGrantModel.replaceForNode(client, 'node-1', [
      { item_kind: 'ability', item_id: 'a1', mode: 'grant' },
      { item_kind: 'spell', item_id: 's1' }, // mode defaults to 'unlock'
      { item_kind: 'bogus', item_id: 'x1' }, // dropped — invalid kind
      { item_kind: 'ability', item_id: null }, // dropped — no id
    ]);

    const calls = client.query.mock.calls;
    expect(calls[0][0]).toMatch(/DELETE FROM skill_tree\.node_grants/);
    const inserts = calls.filter(([sql]) => sql.includes('INSERT INTO skill_tree.node_grants'));
    expect(inserts).toHaveLength(2);
    expect(inserts[0][1]).toEqual(['node-1', 'ability', 'a1', 'grant']);
    expect(inserts[1][1]).toEqual(['node-1', 'spell', 's1', 'unlock']);
  });

  it('dedupes repeated (kind, id) pairs', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await NodeGrantModel.replaceForNode(client, 'node-1', [
      { item_kind: 'ability', item_id: 'a1', mode: 'unlock' },
      { item_kind: 'ability', item_id: 'a1', mode: 'grant' },
    ]);
    const inserts = client.query.mock.calls.filter(([sql]) => sql.includes('INSERT'));
    expect(inserts).toHaveLength(1);
  });

  it('handles an undefined grant list as empty', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await NodeGrantModel.replaceForNode(client, 'node-1', undefined);
    const inserts = client.query.mock.calls.filter(([sql]) => sql.includes('INSERT'));
    expect(inserts).toHaveLength(0);
  });
});
