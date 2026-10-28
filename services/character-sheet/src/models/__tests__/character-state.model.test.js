jest.mock('../../config/db');

const pool = require('../../config/db');
const CharacterStateModel = require('../character-state.model');

function mockClient() {
  const client = { query: jest.fn(), release: jest.fn() };
  pool.connect.mockResolvedValue(client);
  return client;
}

beforeEach(() => jest.clearAllMocks());

describe('withCharacterLock', () => {
  it('locks the row, passes character + skills and commits', async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'c1' }] })
      .mockResolvedValueOnce({ rows: [{ skill_key: 'evasion' }] })
      .mockResolvedValueOnce({}); // COMMIT
    const fn = jest.fn().mockResolvedValue('done');

    const result = await CharacterStateModel.withCharacterLock('c1', fn);

    expect(result).toBe('done');
    expect(client.query.mock.calls[1][0]).toMatch(/FOR UPDATE/);
    expect(fn).toHaveBeenCalledWith(client, { character: { id: 'c1' }, skills: [{ skill_key: 'evasion' }] });
    expect(client.query.mock.calls[3][0]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back and rethrows when the callback fails', async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'c1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});
    const err = new Error('boom');

    await expect(CharacterStateModel.withCharacterLock('c1', () => Promise.reject(err))).rejects.toBe(err);
    expect(client.query.mock.calls[3][0]).toBe('ROLLBACK');
  });

  it('returns null for a missing character', async () => {
    const client = mockClient();
    client.query.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({});
    expect(await CharacterStateModel.withCharacterLock('c1', jest.fn())).toBeNull();
  });
});

describe('saveState', () => {
  it('writes only whitelisted fields and serializes JSON columns', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'c1' }] }) };

    await CharacterStateModel.saveState(client, 'c1', {
      conditions: [{ type: 'fatigue', level: 1 }], rest_timer_hours: 4, name: 'ignored',
    });

    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toMatch(/conditions = \$2::jsonb, rest_timer_hours = \$3/);
    expect(sql).not.toMatch(/name/);
    expect(params).toEqual(['c1', '[{"type":"fatigue","level":1}]', 4]);
  });
});

describe('insertTimerEvent', () => {
  it('reports whether the source_key was new', async () => {
    const client = { query: jest.fn().mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rowCount: 0 }) };
    expect(await CharacterStateModel.insertTimerEvent(client, 'c1', 'combat:s1', 3)).toBe(true);
    expect(await CharacterStateModel.insertTimerEvent(client, 'c1', 'combat:s1', 3)).toBe(false);
    expect(client.query.mock.calls[0][0]).toMatch(/ON CONFLICT \(character_id, source_key\) DO NOTHING/);
  });
});
