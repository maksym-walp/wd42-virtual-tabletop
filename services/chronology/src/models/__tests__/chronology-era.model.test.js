jest.mock('../../config/db');

const pool = require('../../config/db');
const ChronologyEraModel = require('../chronology-era.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('ChronologyEraModel', () => {
  it('lists a calendar\'s eras in chronological order', async () => {
    await ChronologyEraModel.findAllByCalendar('c1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY e\.start_year ASC, m\.order_num ASC, e\.start_day ASC/);
    expect(params).toEqual(['c1']);
  });

  it('monthLengthInCalendar returns the length, or null for a foreign month', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ length: '30' }] });
    await expect(ChronologyEraModel.monthLengthInCalendar('m1', 'c1')).resolves.toBe(30);
    expect(pool.query.mock.calls[0][1]).toEqual(['m1', 'c1']);
    pool.query.mockResolvedValueOnce({ rows: [] });
    await expect(ChronologyEraModel.monthLengthInCalendar('m9', 'c1')).resolves.toBeNull();
  });

  it('create defaults cycle_years to null (a one-off era)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'e1' }] });
    await ChronologyEraModel.create('c1', { name: 'Ера', start_year: 500, start_month_id: 'm1', start_day: 3 });
    expect(pool.query.mock.calls[0][1]).toEqual(['c1', 'Ера', 500, 'm1', 3, null]);
  });

  it('update is scoped by id and calendar_id and returns null on a miss', async () => {
    const result = await ChronologyEraModel.update('e1', 'c1', { name: 'x', start_year: 1, start_month_id: 'm1', start_day: 1, cycle_years: 60 });
    expect(pool.query.mock.calls[0][0]).toMatch(/WHERE id=\$1 AND calendar_id=\$2/);
    expect(pool.query.mock.calls[0][1]).toEqual(['e1', 'c1', 'x', 1, 'm1', 1, 60]);
    expect(result).toBeNull();
  });

  it('delete reports whether a row went away', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    await expect(ChronologyEraModel.delete('e1', 'c1')).resolves.toBe(true);
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    await expect(ChronologyEraModel.delete('e1', 'c1')).resolves.toBe(false);
  });
});
