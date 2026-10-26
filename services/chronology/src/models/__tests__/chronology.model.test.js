jest.mock('../../config/db');

const pool = require('../../config/db');
const ChronologyModel = require('../chronology.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('ChronologyModel.findAll', () => {
  it('restricts to public or own calendars for a regular user', async () => {
    await ChronologyModel.findAll('u1', false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE \(c\.is_private = false OR c\.creator_id = \$1\)/);
    expect(params).toEqual(['u1']);
  });

  it('sees everything when admin', async () => {
    await ChronologyModel.findAll('u1', true);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE TRUE/);
  });
});

describe('ChronologyModel.findAll ordering', () => {
  it('puts the default calendar first', async () => {
    await ChronologyModel.findAll('u1', false);
    expect(pool.query.mock.calls[0][0]).toMatch(/ORDER BY c\.is_default DESC, c\.name ASC/);
  });
});

describe('ChronologyModel.setDefault', () => {
  const client = { query: jest.fn(), release: jest.fn() };
  const run = (targetOffset) => {
    client.query.mockReset().mockImplementation(async (sql) => {
      if (/FOR UPDATE/.test(sql)) return { rows: [{ sync_offset_days: targetOffset }] };
      if (/RETURNING/.test(sql)) return { rows: [{ id: 'c1', is_default: true }] };
      return { rows: [] };
    });
  };
  const sqls = () => client.query.mock.calls.map(([sql]) => sql);
  beforeEach(() => {
    client.release.mockReset();
    pool.connect = jest.fn().mockResolvedValue(client);
  });

  it('demotes the old default keeping its axis position, then promotes the target', async () => {
    run(7);
    const row = await ChronologyModel.setDefault('c1', true);
    const q = sqls();
    expect(q[0]).toBe('BEGIN');
    expect(q[1]).toMatch(/FOR UPDATE/);
    expect(q[2]).toMatch(/SET is_default = false, sync_offset_days = COALESCE\(sync_offset_days, 0\)\s+WHERE is_default AND id <> \$1/);
    expect(q[3]).toMatch(/SET is_default = true, sync_offset_days = COALESCE\(sync_offset_days, 0\)/);
    expect(q).toHaveLength(5); // BEGIN, SELECT, demote, promote, COMMIT — a synced target keeps everyone synced
    expect(q[4]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalled();
    expect(row).toEqual({ id: 'c1', is_default: true });
  });

  it('drops every other calendar\'s sync when the new default was never synced', async () => {
    run(null);
    await ChronologyModel.setDefault('c1', true);
    expect(sqls()).toContainEqual(expect.stringMatching(/SET sync_offset_days = NULL WHERE id <> \$1/));
  });

  it('returns null and does not touch anything for an unknown calendar', async () => {
    client.query.mockReset().mockResolvedValue({ rows: [] });
    expect(await ChronologyModel.setDefault('nope', true)).toBeNull();
    expect(sqls().filter((q) => /^UPDATE/.test(q.trim()))).toHaveLength(0);
  });

  it('keeps the calendar\'s axis position when unsetting', async () => {
    run(0);
    await ChronologyModel.setDefault('c1', false);
    const q = sqls();
    expect(q).toHaveLength(3); // BEGIN, UPDATE, COMMIT
    expect(q[1]).toMatch(/SET is_default = false, sync_offset_days = COALESCE/);
    expect(client.query.mock.calls[1][1]).toEqual(['c1']);
  });

  it('rolls back and releases on failure', async () => {
    client.query.mockReset().mockImplementation(async (sql) => {
      if (/FOR UPDATE/.test(sql)) throw new Error('boom');
      return { rows: [] };
    });
    await expect(ChronologyModel.setDefault('c1', true)).rejects.toThrow('boom');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('ChronologyModel.setSyncOffset / hasDefault', () => {
  it('writes the offset (or null) by id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1', sync_offset_days: -40 }] });
    const row = await ChronologyModel.setSyncOffset('c1', -40);
    expect(pool.query.mock.calls[0][1]).toEqual(['c1', -40]);
    expect(row.sync_offset_days).toBe(-40);
  });

  it('hasDefault reflects whether a default row exists', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    expect(await ChronologyModel.hasDefault()).toBe(true);
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await ChronologyModel.hasDefault()).toBe(false);
  });
});

describe('ChronologyModel.findById', () => {
  it('scopes visibility the same way as findAll', async () => {
    await ChronologyModel.findById('cal-1', 'u1', false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/c\.id = \$1 AND \(c\.is_private = false OR c\.creator_id = \$2\)/);
    expect(params).toEqual(['cal-1', 'u1']);
  });
});

describe('ChronologyModel.findByIdRaw', () => {
  it('has no visibility filter', async () => {
    await ChronologyModel.findByIdRaw('cal-1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1/);
    expect(sql).not.toMatch(/is_private/);
    expect(params).toEqual(['cal-1']);
  });
});

describe('ChronologyModel.create', () => {
  it('applies defaults for optional fields', async () => {
    await ChronologyModel.create('u1', { name: 'Гарія' });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['u1', 'Гарія', null, null, null, 0, false]);
  });
});

describe('ChronologyModel.update', () => {
  it('applies defaults for optional fields, including the new default view columns', async () => {
    await ChronologyModel.update('cal-1', { name: 'Гарія' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/default_year=\$8, default_month_id=\$9/);
    expect(params).toEqual(['cal-1', 'Гарія', null, null, null, 0, false, null, null, null, null, null, null, null, null, null]);
  });

  it('passes through an explicit default_year/default_month_id', async () => {
    await ChronologyModel.update('cal-1', { name: 'Гарія', default_year: 100, default_month_id: 'm1' });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['cal-1', 'Гарія', null, null, null, 0, false, 100, 'm1', null, null, null, null, null, null, null]);
  });

  it('stores custom terms, treating blanks as the default (null)', async () => {
    await ChronologyModel.update('cal-1', { name: 'Гарія', term_day: 'Доба', term_week: '', term_month: 'Декада', term_year: 'Оберт' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/term_day=\$10, term_week=\$11, term_season=\$12, term_year=\$13, term_month=\$14/);
    expect(params.slice(9)).toEqual(['Доба', null, null, 'Оберт', 'Декада', null, null]);
  });

  it('stores the week length and the current day', async () => {
    await ChronologyModel.update('cal-1', { name: 'Гарія', week_length: 10, default_day: 4 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/week_length=\$15, default_day=\$16/);
    expect(params.slice(14)).toEqual([10, 4]);
  });
});

describe('ChronologyModel.monthBelongsToCalendar', () => {
  it('returns true when the month exists for that calendar', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    await expect(ChronologyModel.monthBelongsToCalendar('m1', 'cal-1')).resolves.toBe(true);
    expect(pool.query.mock.calls[0][1]).toEqual(['m1', 'cal-1']);
  });

  it('returns false when it does not', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await expect(ChronologyModel.monthBelongsToCalendar('m1', 'cal-1')).resolves.toBe(false);
  });
});

describe('ChronologyModel.delete', () => {
  it('returns true when a row was deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });
    await expect(ChronologyModel.delete('cal-1')).resolves.toBe(true);
  });

  it('returns false when nothing was deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 0 });
    await expect(ChronologyModel.delete('missing')).resolves.toBe(false);
  });
});
