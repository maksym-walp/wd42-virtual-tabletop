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
      name: 'Bob', archetype: 'warrior', raceId: 'r1',
      skills: { evasion: 0, strength: 15, acrobatics: 7 },
    });

    const skillCalls = client.query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO character_sheet.skills'));
    const byKey = Object.fromEntries(skillCalls.map(([, params]) => [params[1], params[2]]));

    expect(byKey.evasion).toBe(1); // clamped up from 0
    expect(byKey.strength).toBe(12); // clamped down from 15
    expect(byKey.acrobatics).toBe(7); // in range, unchanged
  });

  it('runs BEGIN then COMMIT and releases the client on success', async () => {
    await CharacterModel.create('u1', { name: 'Bob', archetype: 'warrior', raceId: 'r1' });

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
      CharacterModel.create('u1', { name: 'Bob', archetype: 'warrior', raceId: 'r1' })
    ).rejects.toThrow('db exploded');

    const sqlSequence = client.query.mock.calls.map(([sql]) => sql);
    expect(sqlSequence).toContain('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('CharacterModel.create with a people', () => {
  it('stores the people with its bonus snapshot and starts bonus skills above 1', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
    client.query.mockImplementation((sql) => (
      sql.includes('INSERT INTO character_sheet.characters')
        ? Promise.resolve({ rows: [{ id: 'char1' }] })
        : Promise.resolve({ rows: [] })
    ));

    await CharacterModel.create('u1', {
      name: 'Bob', archetype: 'fighter', raceId: 'r1',
      peopleId: 'p1', peopleBonus: { strength: 2 },
    });

    const insert = client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO character_sheet.characters'));
    expect(insert[1]).toEqual(['u1', 'Bob', 'fighter', 'r1', 'p1', '{"strength":2}']);
    const skillCalls = client.query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO character_sheet.skills'));
    const byKey = Object.fromEntries(skillCalls.map(([, params]) => [params[1], params[2]]));
    expect(byKey.strength).toBe(3);
    expect(byKey.evasion).toBe(1);
  });
});

describe('CharacterModel.setPeople', () => {
  let client;

  beforeEach(() => {
    client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
  });

  function mockCurrent(peopleBonus) {
    client.query.mockImplementation((sql) => {
      if (sql.includes('SELECT people_bonus')) return Promise.resolve({ rows: [{ people_bonus: peopleBonus }] });
      if (sql.includes('UPDATE character_sheet.characters')) return Promise.resolve({ rows: [{ id: 'c1' }] });
      return Promise.resolve({ rows: [] });
    });
  }

  const skillUpdates = () => client.query.mock.calls
    .filter(([sql]) => sql.includes('UPDATE character_sheet.skills'))
    .map(([, params]) => params);

  it('applies the bonus of a first people as a delta to value and base_value', async () => {
    mockCurrent({});

    await CharacterModel.setPeople('c1', 'p1', { strength: 1, will: 2 });

    expect(skillUpdates()).toEqual([['c1', 'strength', 1], ['c1', 'will', 2]]);
    expect(client.query.mock.calls[client.query.mock.calls.length - 1][0]).toBe('COMMIT');
  });

  it('swaps bonuses: subtracts the old snapshot and adds the new one', async () => {
    mockCurrent({ strength: 1, will: 2 });

    await CharacterModel.setPeople('c1', 'p2', { strength: 1, perception: 1 });

    // strength unchanged -> no update; will loses 2; perception gains 1
    expect(skillUpdates()).toEqual([['c1', 'will', -2], ['c1', 'perception', 1]]);
  });

  it('removes the bonus and stores an empty snapshot when the people is cleared', async () => {
    mockCurrent({ strength: 1 });

    await CharacterModel.setPeople('c1', null, { strength: 5 });

    expect(skillUpdates()).toEqual([['c1', 'strength', -1]]);
    const characterUpdate = client.query.mock.calls.find(([sql]) => sql.includes('SET people_id'));
    expect(characterUpdate[1]).toEqual(['c1', null, '{}']);
  });

  it('returns null and rolls back when the character does not exist', async () => {
    client.query.mockResolvedValue({ rows: [] });

    await expect(CharacterModel.setPeople('missing', 'p1', {})).resolves.toBeNull();
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('CharacterModel.findAllPublic', () => {
  beforeEach(() => {
    pool.query.mockResolvedValue({ rows: [] });
  });

  it('filters to public, other-user, non-admin-authored characters with a default limit', async () => {
    await CharacterModel.findAllPublic('u1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE c\.is_public = true AND c\.user_id <> \$1 AND ou\.role IS DISTINCT FROM 'admin'/);
    expect(sql).toMatch(/ORDER BY c\.created_at DESC/);
    expect(sql).toMatch(/LIMIT \$2/);
    expect(params).toEqual(['u1', 15]);
  });

  it('honors a custom limit', async () => {
    await CharacterModel.findAllPublic('u1', { limit: 5 });
    const params = pool.query.mock.calls[0][1];
    expect(params).toEqual(['u1', 5]);
  });
});

describe('CharacterModel.update death_scale handling', () => {
  beforeEach(() => {
    pool.query.mockResolvedValue({ rows: [{ id: 'c1' }] });
  });

  it('leaves death_scale untouched when the field is not provided at all', async () => {
    await CharacterModel.update('c1', { name: 'New name' });
    const params = pool.query.mock.calls[0][1];
    expect(params[8]).toBe(false); // setDeathScale flag
    expect(params[9]).toBeNull();
  });

  it('applies an explicit null (clearing death_scale) when the key is present', async () => {
    await CharacterModel.update('c1', { death_scale: null });
    const params = pool.query.mock.calls[0][1];
    expect(params[8]).toBe(true);
    expect(params[9]).toBeNull();
  });

  it('applies a falsy-but-valid value (0) distinctly from "not provided"', async () => {
    await CharacterModel.update('c1', { death_scale: 0 });
    const params = pool.query.mock.calls[0][1];
    expect(params[8]).toBe(true);
    expect(params[9]).toBe(0);
  });
});
