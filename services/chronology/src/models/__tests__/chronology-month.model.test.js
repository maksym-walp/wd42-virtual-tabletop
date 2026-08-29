jest.mock('../../config/db');

const pool = require('../../config/db');
const ChronologyMonthModel = require('../chronology-month.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

it('findAllByCalendar orders by order_num', async () => {
  await ChronologyMonthModel.findAllByCalendar('cal-1');
  const [sql, params] = pool.query.mock.calls[0];
  expect(sql).toMatch(/WHERE calendar_id = \$1 ORDER BY order_num ASC/);
  expect(params).toEqual(['cal-1']);
});

it('create inserts scoped to the calendar', async () => {
  await ChronologyMonthModel.create('cal-1', { name: 'Місяць першоцвіту', length: 30, order_num: 1 });
  const [, params] = pool.query.mock.calls[0];
  expect(params).toEqual(['cal-1', 'Місяць першоцвіту', 30, 1]);
});

it('update/delete scope by id and calendar_id together', async () => {
  await ChronologyMonthModel.update('m1', 'cal-1', { name: 'x', length: 28, order_num: 2 });
  expect(pool.query.mock.calls[0][0]).toMatch(/WHERE id=\$1 AND calendar_id=\$2/);

  pool.query.mockResolvedValue({ rowCount: 1 });
  await expect(ChronologyMonthModel.delete('m1', 'cal-1')).resolves.toBe(true);
  expect(pool.query.mock.calls[1][0]).toMatch(/WHERE id=\$1 AND calendar_id=\$2/);
});
