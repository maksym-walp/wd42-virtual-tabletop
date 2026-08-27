jest.mock('../../config/db');

const pool = require('../../config/db');
const CalendarMoonModel = require('../calendar-moon.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

it('findAllByCalendar scopes to the calendar', async () => {
  await CalendarMoonModel.findAllByCalendar('cal-1');
  const [sql, params] = pool.query.mock.calls[0];
  expect(sql).toMatch(/WHERE calendar_id = \$1/);
  expect(params).toEqual(['cal-1']);
});

it('create defaults shift to 0 when omitted', async () => {
  await CalendarMoonModel.create('cal-1', { name: 'Селена', cycle_length: 29.5, color: '#dddddd' });
  const [, params] = pool.query.mock.calls[0];
  expect(params).toEqual(['cal-1', 'Селена', 29.5, 0, '#dddddd']);
});

it('update/delete scope by id and calendar_id together', async () => {
  await CalendarMoonModel.update('mo1', 'cal-1', { name: 'x', cycle_length: 14, shift: 2, color: '#fff' });
  expect(pool.query.mock.calls[0][0]).toMatch(/WHERE id=\$1 AND calendar_id=\$2/);

  pool.query.mockResolvedValue({ rowCount: 0 });
  await expect(CalendarMoonModel.delete('mo1', 'cal-1')).resolves.toBe(false);
  expect(pool.query.mock.calls[1][0]).toMatch(/WHERE id=\$1 AND calendar_id=\$2/);
});
