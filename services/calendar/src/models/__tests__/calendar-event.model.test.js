jest.mock('../../config/db');

const pool = require('../../config/db');
const CalendarEventModel = require('../calendar-event.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('CalendarEventModel.findAllByCalendar', () => {
  it('with no campaignId, only returns global events, and hides private ones by default', async () => {
    await CalendarEventModel.findAllByCalendar('cal-1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE calendar_id = \$1 AND campaign_id IS NULL AND is_public = true/);
    expect(params).toEqual(['cal-1']);
  });

  it('with campaignId, returns global events plus that campaign\'s own', async () => {
    await CalendarEventModel.findAllByCalendar('cal-1', { campaignId: 'camp-1' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/\(campaign_id IS NULL OR campaign_id = \$2\)/);
    expect(params).toEqual(['cal-1', 'camp-1']);
  });

  it('includePrivate drops the is_public filter for managers', async () => {
    await CalendarEventModel.findAllByCalendar('cal-1', { includePrivate: true });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/AND TRUE/);
    expect(sql).not.toMatch(/is_public = true/);
  });
});

describe('CalendarEventModel.monthBelongsToCalendar', () => {
  it('returns true when the month exists for that calendar', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    await expect(CalendarEventModel.monthBelongsToCalendar('m1', 'cal-1')).resolves.toBe(true);
    expect(pool.query.mock.calls[0][1]).toEqual(['m1', 'cal-1']);
  });

  it('returns false otherwise', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await expect(CalendarEventModel.monthBelongsToCalendar('m1', 'cal-1')).resolves.toBe(false);
  });
});

describe('CalendarEventModel.create', () => {
  it('applies defaults for optional fields', async () => {
    await CalendarEventModel.create('cal-1', { name: 'Битва за Гарію', color: '#ff0000' });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['cal-1', null, 'Битва за Гарію', null, '#ff0000', true, null, null, null, 'none']);
  });

  it('passes through a global event (campaign_id null) as-is', async () => {
    await CalendarEventModel.create('cal-1', {
      campaign_id: null, name: 'Заснування міста', color: '#4caf50', is_public: false, recurrence: 'yearly',
      year: 100, month_id: 'm1', day: 1,
    });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['cal-1', null, 'Заснування міста', null, '#4caf50', false, 100, 'm1', 1, 'yearly']);
  });
});

describe('CalendarEventModel.update/delete', () => {
  it('scope by id and calendar_id together', async () => {
    await CalendarEventModel.update('e1', 'cal-1', { name: 'x', color: '#000000' });
    expect(pool.query.mock.calls[0][0]).toMatch(/WHERE id=\$1 AND calendar_id=\$2/);

    pool.query.mockResolvedValue({ rowCount: 1 });
    await expect(CalendarEventModel.delete('e1', 'cal-1')).resolves.toBe(true);
    expect(pool.query.mock.calls[1][0]).toMatch(/WHERE id=\$1 AND calendar_id=\$2/);
  });
});
