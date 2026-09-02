jest.mock('../../config/db');
jest.mock('../character.model');

const pool = require('../../config/db');
const CharacterModel = require('../character.model');
const TreeProgressModel = require('../tree-progress.model');

let client;

beforeEach(() => {
  jest.clearAllMocks();
  client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
  pool.connect.mockResolvedValue(client);
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
  it('inserts the progress row, applies grants and commits on a fresh unlock', async () => {
    client.query.mockImplementation((sql) => {
      if (sql.includes('INSERT INTO character_sheet.tree_progress')) {
        return Promise.resolve({ rows: [{ id: 'p1', node_id: 'n1' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await TreeProgressModel.unlock('c1', 'n1');

    expect(result.progress).toEqual({ id: 'p1', node_id: 'n1' });
    expect(result.granted).toEqual({ abilities: [], maneuvers: [], spells: [] });
    const seq = client.query.mock.calls.map(([sql]) => sql);
    expect(seq[0]).toBe('BEGIN');
    expect(seq[seq.length - 1]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('returns a null progress (and skips grants) when the node was already unlocked', async () => {
    client.query.mockResolvedValue({ rows: [] }); // ON CONFLICT DO NOTHING

    const result = await TreeProgressModel.unlock('c1', 'n1');

    expect(result.progress).toBeNull();
    const seq = client.query.mock.calls.map(([sql]) => sql);
    expect(seq.some((s) => s.includes('node_grants'))).toBe(false);
    expect(seq[seq.length - 1]).toBe('COMMIT');
  });

  it('expands a granted ability and reports it', async () => {
    client.query.mockImplementation((sql) => {
      if (sql.includes('INSERT INTO character_sheet.tree_progress')) return Promise.resolve({ rows: [{ id: 'p1' }] });
      if (sql.includes('FROM skill_tree.node_grants')) return Promise.resolve({ rows: [{ item_kind: 'ability', item_id: 'a1' }] });
      if (sql.includes('INSERT INTO character_sheet.abilities')) return Promise.resolve({ rows: [{ character_id: 'c1', ability_id: 'a1' }] });
      return Promise.resolve({ rows: [] });
    });

    const result = await TreeProgressModel.unlock('c1', 'n1');

    expect(result.granted.abilities).toEqual([{ character_id: 'c1', ability_id: 'a1' }]);
  });

  it('rolls back and rethrows on failure', async () => {
    client.query.mockImplementation((sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return Promise.resolve();
      return Promise.reject(new Error('boom'));
    });

    await expect(TreeProgressModel.unlock('c1', 'n1')).rejects.toThrow('boom');
    expect(client.query.mock.calls.map(([s]) => s)).toContain('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('TreeProgressModel.canUnlock', () => {
  it('404s when the node does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const result = await TreeProgressModel.canUnlock('c1', 'nope');
    expect(result).toEqual({ ok: false, status: 404, message: 'Вузол не знайдено' });
  });

  it('403s when a required prerequisite edge is not unlocked', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'n2', cost: 0, require_both: false, narrative_condition: [] }] })
      .mockResolvedValueOnce({ rows: [{ source_id: 'n1', edge_type: 'required' }] })
      .mockResolvedValueOnce({ rows: [] }); // nothing unlocked

    const result = await TreeProgressModel.canUnlock('c1', 'n2');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it('403s when points are mandatory and unaffordable', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'n2', cost: 5, require_both: false, narrative_condition: [] }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    CharacterModel.experienceSummary.mockResolvedValue({ remaining: 2 });

    const result = await TreeProgressModel.canUnlock('c1', 'n2');
    expect(result).toEqual({ ok: false, status: 403, message: 'Недостатньо пунктів досвіду' });
  });

  it('ok when a narrative alternative exists even if points are short', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'n2', cost: 5, require_both: false, narrative_condition: ['do a thing'] }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await TreeProgressModel.canUnlock('c1', 'n2');
    expect(result).toEqual({ ok: true });
    expect(CharacterModel.experienceSummary).not.toHaveBeenCalled();
  });

  it('ok when prerequisites are met and the node is free', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'n2', cost: 0, require_both: false, narrative_condition: [] }] })
      .mockResolvedValueOnce({ rows: [{ source_id: 'n1', edge_type: 'required' }] })
      .mockResolvedValueOnce({ rows: [{ node_id: 'n1' }] });

    const result = await TreeProgressModel.canUnlock('c1', 'n2');
    expect(result).toEqual({ ok: true });
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
