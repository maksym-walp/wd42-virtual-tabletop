jest.mock('../../config/db');

const pool = require('../../config/db');
const UserModel = require('../user.model');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UserModel', () => {
  it('findByEmail returns null when no row matches', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const result = await UserModel.findByEmail('nope@b.com');
    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE email = $1'), ['nope@b.com']);
  });

  it('findByEmail returns the row when found', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'u1', email: 'a@b.com' }] });
    const result = await UserModel.findByEmail('a@b.com');
    expect(result).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('create inserts with the given fields and returns the row', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'u1' }] });
    const result = await UserModel.create({ email: 'a@b.com', username: 'alice', passwordHash: 'hash' });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO auth.users'), ['a@b.com', 'alice', 'hash']);
    expect(result).toEqual({ id: 'u1' });
  });

  it('findRefreshToken returns null when nothing matches', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const result = await UserModel.findRefreshToken('u1', 'hash');
    expect(result).toBeNull();
  });
});
