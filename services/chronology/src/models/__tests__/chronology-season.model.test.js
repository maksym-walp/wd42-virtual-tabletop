jest.mock('../../config/db');

const pool = require('../../config/db');
const ChronologySeasonModel = require('../chronology-season.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

it('findAllByCalendar orders by the start month position, then start_day', async () => {
  await ChronologySeasonModel.findAllByCalendar('cal-1');
  const [sql, params] = pool.query.mock.calls[0];
  expect(sql).toMatch(/JOIN chronology\.calendar_months m ON m\.id = s\.start_month_id/);
  expect(sql).toMatch(/ORDER BY m\.order_num ASC, s\.start_day ASC/);
  expect(params).toEqual(['cal-1']);
});

describe('monthBelongsToCalendar', () => {
  it('returns true when the month row exists for that calendar', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    await expect(ChronologySeasonModel.monthBelongsToCalendar('m1', 'cal-1')).resolves.toBe(true);
    expect(pool.query.mock.calls[0][1]).toEqual(['m1', 'cal-1']);
  });

  it('returns false when it does not', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await expect(ChronologySeasonModel.monthBelongsToCalendar('m1', 'cal-1')).resolves.toBe(false);
  });
});

it('create inserts scoped to the calendar with a nullable bg_image_url', async () => {
  await ChronologySeasonModel.create('cal-1', { name: 'Літо', start_month_id: 'm1', start_day: 1, color: '#4caf50' });
  const [, params] = pool.query.mock.calls[0];
  expect(params).toEqual(['cal-1', 'Літо', 'm1', 1, '#4caf50', null]);
});

it('update/delete scope by id and calendar_id together', async () => {
  await ChronologySeasonModel.update('s1', 'cal-1', { name: 'x', start_month_id: 'm1', start_day: 5, color: '#000000' });
  expect(pool.query.mock.calls[0][0]).toMatch(/WHERE id=\$1 AND calendar_id=\$2/);

  pool.query.mockResolvedValue({ rowCount: 1 });
  await expect(ChronologySeasonModel.delete('s1', 'cal-1')).resolves.toBe(true);
  expect(pool.query.mock.calls[1][0]).toMatch(/WHERE id=\$1 AND calendar_id=\$2/);
});
