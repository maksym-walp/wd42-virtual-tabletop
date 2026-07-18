jest.mock('../db');

const pool = require('../db');
const seedAdmins = require('../seedAdmins');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
  delete process.env.ADMIN_USERNAMES;
});

describe('seedAdmins', () => {
  it('does nothing when ADMIN_USERNAMES is unset', async () => {
    await seedAdmins();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('does nothing when ADMIN_USERNAMES is empty/whitespace', async () => {
    process.env.ADMIN_USERNAMES = ' , ,';
    await seedAdmins();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('promotes the parsed, trimmed username list to admin idempotently', async () => {
    process.env.ADMIN_USERNAMES = ' alice , bob ';
    await seedAdmins();

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/SET role = 'admin'/);
    expect(sql).toMatch(/WHERE username = ANY\(\$1\) AND role <> 'admin'/);
    expect(params).toEqual([['alice', 'bob']]);
  });

  it('never throws even if the update fails', async () => {
    process.env.ADMIN_USERNAMES = 'alice';
    pool.query.mockRejectedValue(new Error('db down'));
    await expect(seedAdmins()).resolves.toBeUndefined();
  });
});
