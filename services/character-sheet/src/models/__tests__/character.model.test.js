jest.mock('../../config/db');

const pool = require('../../config/db');
const CharacterModel = require('../character.model');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CharacterModel.create', () => {
  let client;

  beforeEach(() => {
    client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
    client.query.mockImplementation((sql) => {
      if (sql.includes('INSERT INTO character_sheet.characters')) {
        return Promise.resolve({ rows: [{ id: 'char1' }] });
      }
      return Promise.resolve({ rows: [] });
    });
  });

  it('clamps skill values into the 1-12 range', async () => {
    await CharacterModel.create('u1', {
      name: 'Bob', archetype: 'warrior', race: 'human',
      skills: { evasion: 0, strength: 15, acrobatics: 7 },
    });

    const skillCalls = client.query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO character_sheet.skills'));
    const byKey = Object.fromEntries(skillCalls.map(([, params]) => [params[1], params[2]]));

    expect(byKey.evasion).toBe(1); // clamped up from 0
    expect(byKey.strength).toBe(12); // clamped down from 15
    expect(byKey.acrobatics).toBe(7); // in range, unchanged
  });

  it('runs BEGIN then COMMIT and releases the client on success', async () => {
    await CharacterModel.create('u1', { name: 'Bob', archetype: 'warrior', race: 'human' });

    const sqlSequence = client.query.mock.calls.map(([sql]) => sql);
    expect(sqlSequence[0]).toBe('BEGIN');
    expect(sqlSequence[sqlSequence.length - 1]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back and rethrows if an insert fails mid-transaction', async () => {
    client.query.mockImplementation((sql) => {
      if (sql.includes('INSERT INTO character_sheet.characters')) {
        return Promise.resolve({ rows: [{ id: 'char1' }] });
      }
      if (sql.includes('INSERT INTO character_sheet.skills')) {
        return Promise.reject(new Error('db exploded'));
      }
      return Promise.resolve({ rows: [] });
    });

    await expect(
      CharacterModel.create('u1', { name: 'Bob', archetype: 'warrior', race: 'human' })
    ).rejects.toThrow('db exploded');

    const sqlSequence = client.query.mock.calls.map(([sql]) => sql);
    expect(sqlSequence).toContain('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('CharacterModel.update death_scale handling', () => {
  beforeEach(() => {
    pool.query.mockResolvedValue({ rows: [{ id: 'c1' }] });
  });

  it('leaves death_scale untouched when the field is not provided at all', async () => {
    await CharacterModel.update('c1', 'u1', { name: 'New name' });
    const params = pool.query.mock.calls[0][1];
    expect(params[9]).toBe(false); // setDeathScale flag
    expect(params[10]).toBeNull();
  });

  it('applies an explicit null (clearing death_scale) when the key is present', async () => {
    await CharacterModel.update('c1', 'u1', { death_scale: null });
    const params = pool.query.mock.calls[0][1];
    expect(params[9]).toBe(true);
    expect(params[10]).toBeNull();
  });

  it('applies a falsy-but-valid value (0) distinctly from "not provided"', async () => {
    await CharacterModel.update('c1', 'u1', { death_scale: 0 });
    const params = pool.query.mock.calls[0][1];
    expect(params[9]).toBe(true);
    expect(params[10]).toBe(0);
  });
});
