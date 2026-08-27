jest.mock('../../config/db');

const pool = require('../../config/db');
const CalendarWeekdayModel = require('../calendar-weekday.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

it('findAllByCalendar orders by order_num', async () => {
  await CalendarWeekdayModel.findAllByCalendar('cal-1');
  const [sql, params] = pool.query.mock.calls[0];
  expect(sql).toMatch(/WHERE calendar_id = \$1 ORDER BY order_num ASC/);
  expect(params).toEqual(['cal-1']);
});

it('create inserts scoped to the calendar', async () => {
  await CalendarWeekdayModel.create('cal-1', { name: 'Сонцедень', order_num: 0 });
  const [, params] = pool.query.mock.calls[0];
  expect(params).toEqual(['cal-1', 'Сонцедень', 0]);
});

it('delete scopes by id and calendar_id together', async () => {
  pool.query.mockResolvedValue({ rowCount: 0 });
  await expect(CalendarWeekdayModel.delete('w1', 'cal-1')).resolves.toBe(false);
  expect(pool.query.mock.calls[0][0]).toMatch(/WHERE id=\$1 AND calendar_id=\$2/);
});
