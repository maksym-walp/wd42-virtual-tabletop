jest.mock('../../config/db');

const pool = require('../../config/db');
const CalendarModel = require('../calendar.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('CalendarModel.findAll', () => {
  it('restricts to public or own calendars for a regular user', async () => {
    await CalendarModel.findAll('u1', false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE \(c\.is_private = false OR c\.creator_id = \$1\)/);
    expect(params).toEqual(['u1']);
  });

  it('sees everything when admin', async () => {
    await CalendarModel.findAll('u1', true);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE TRUE/);
  });
});

describe('CalendarModel.findById', () => {
  it('scopes visibility the same way as findAll', async () => {
    await CalendarModel.findById('cal-1', 'u1', false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/c\.id = \$1 AND \(c\.is_private = false OR c\.creator_id = \$2\)/);
    expect(params).toEqual(['cal-1', 'u1']);
  });
});

describe('CalendarModel.findByIdRaw', () => {
  it('has no visibility filter', async () => {
    await CalendarModel.findByIdRaw('cal-1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1/);
    expect(sql).not.toMatch(/is_private/);
    expect(params).toEqual(['cal-1']);
  });
});

describe('CalendarModel.create', () => {
  it('applies defaults for optional fields', async () => {
    await CalendarModel.create('u1', { name: 'Гарія' });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['u1', 'Гарія', null, null, null, 0, false]);
  });
});

describe('CalendarModel.update', () => {
  it('applies defaults for optional fields, including the new default view columns', async () => {
    await CalendarModel.update('cal-1', { name: 'Гарія' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/default_year=\$8, default_month_id=\$9/);
    expect(params).toEqual(['cal-1', 'Гарія', null, null, null, 0, false, null, null]);
  });

  it('passes through an explicit default_year/default_month_id', async () => {
    await CalendarModel.update('cal-1', { name: 'Гарія', default_year: 100, default_month_id: 'm1' });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['cal-1', 'Гарія', null, null, null, 0, false, 100, 'm1']);
  });
});

describe('CalendarModel.monthBelongsToCalendar', () => {
  it('returns true when the month exists for that calendar', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    await expect(CalendarModel.monthBelongsToCalendar('m1', 'cal-1')).resolves.toBe(true);
    expect(pool.query.mock.calls[0][1]).toEqual(['m1', 'cal-1']);
  });

  it('returns false when it does not', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await expect(CalendarModel.monthBelongsToCalendar('m1', 'cal-1')).resolves.toBe(false);
  });
});

describe('CalendarModel.delete', () => {
  it('returns true when a row was deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });
    await expect(CalendarModel.delete('cal-1')).resolves.toBe(true);
  });

  it('returns false when nothing was deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 0 });
    await expect(CalendarModel.delete('missing')).resolves.toBe(false);
  });
});
