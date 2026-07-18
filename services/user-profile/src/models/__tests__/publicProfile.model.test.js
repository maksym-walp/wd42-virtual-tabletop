jest.mock('../../config/db');

const pool = require('../../config/db');
const PublicProfileModel = require('../publicProfile.model');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PublicProfileModel.findUserByUsername', () => {
  it('looks up an active user by username', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'u1', username: 'alice' }] });
    const user = await PublicProfileModel.findUserByUsername('alice');

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM auth\.users WHERE username = \$1 AND is_active = true/);
    expect(params).toEqual(['alice']);
    expect(user).toEqual({ id: 'u1', username: 'alice' });
  });

  it('returns null when no user matches', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    expect(await PublicProfileModel.findUserByUsername('ghost')).toBeNull();
  });
});

describe('PublicProfileModel.getPublicActivity', () => {
  it('queries every domain scoped to the user and only public rows', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await PublicProfileModel.getPublicActivity('u1');

    // 6 aggregation queries: characters, equipment, spells, abilities, maneuvers, collections
    expect(pool.query).toHaveBeenCalledTimes(6);
    for (const [sql, params] of pool.query.mock.calls) {
      expect(sql).toMatch(/is_public = true/);
      expect(params).toEqual(['u1']);
    }
  });

  it('returns the six named collections keyed by domain', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'c1' }] })            // characters
      .mockResolvedValueOnce({ rows: [{ id: 'e1' }] })            // equipment
      .mockResolvedValueOnce({ rows: [{ id: 's1' }] })            // spells
      .mockResolvedValueOnce({ rows: [{ id: 'a1' }] })            // abilities
      .mockResolvedValueOnce({ rows: [{ id: 'm1' }] })            // maneuvers
      .mockResolvedValueOnce({ rows: [{ id: 'col1', domain: 'equipment' }] }); // collections

    const result = await PublicProfileModel.getPublicActivity('u1');

    expect(result).toEqual({
      characters: [{ id: 'c1' }],
      equipment: [{ id: 'e1' }],
      spells: [{ id: 's1' }],
      abilities: [{ id: 'a1' }],
      maneuvers: [{ id: 'm1' }],
      collections: [{ id: 'col1', domain: 'equipment' }],
    });
  });
});
