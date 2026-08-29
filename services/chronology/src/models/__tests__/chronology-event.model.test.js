jest.mock('../../config/db');

const pool = require('../../config/db');
const ChronologyEventModel = require('../chronology-event.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('ChronologyEventModel.findAllByCalendar', () => {
  it('with no campaignId, only returns global events, and hides private ones by default', async () => {
    await ChronologyEventModel.findAllByCalendar('cal-1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE calendar_id = \$1 AND campaign_id IS NULL AND is_public = true/);
    expect(params).toEqual(['cal-1']);
  });

  it('with campaignId, returns global events plus that campaign\'s own', async () => {
    await ChronologyEventModel.findAllByCalendar('cal-1', { campaignId: 'camp-1' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/\(campaign_id IS NULL OR campaign_id = \$2\)/);
    expect(params).toEqual(['cal-1', 'camp-1']);
  });

  it('includePrivate drops the is_public filter for managers', async () => {
    await ChronologyEventModel.findAllByCalendar('cal-1', { includePrivate: true });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/AND TRUE/);
    expect(sql).not.toMatch(/is_public = true/);
  });

  it('returns [] without a second query when there are no events', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const result = await ChronologyEventModel.findAllByCalendar('cal-1');
    expect(result).toEqual([]);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('attaches participant_ids resolved from the join table', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'e1' }, { id: 'e2' }] })
      .mockResolvedValueOnce({ rows: [{ event_id: 'e1', entry_id: 'npc-1' }, { event_id: 'e1', entry_id: 'npc-2' }] });

    const result = await ChronologyEventModel.findAllByCalendar('cal-1');

    expect(pool.query.mock.calls[1][0]).toMatch(/calendar_event_participants WHERE event_id = ANY/);
    expect(pool.query.mock.calls[1][1]).toEqual([['e1', 'e2']]);
    expect(result).toEqual([
      { id: 'e1', participant_ids: ['npc-1', 'npc-2'] },
      { id: 'e2', participant_ids: [] },
    ]);
  });
});

describe('ChronologyEventModel.monthBelongsToCalendar', () => {
  it('returns true when the month exists for that calendar', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    await expect(ChronologyEventModel.monthBelongsToCalendar('m1', 'cal-1')).resolves.toBe(true);
    expect(pool.query.mock.calls[0][1]).toEqual(['m1', 'cal-1']);
  });

  it('returns false otherwise', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await expect(ChronologyEventModel.monthBelongsToCalendar('m1', 'cal-1')).resolves.toBe(false);
  });
});

describe('ChronologyEventModel.create', () => {
  it('applies defaults for optional fields and clears participants when none given', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'e1' }] });
    const event = await ChronologyEventModel.create('cal-1', { name: 'Битва за Гарію', color: '#ff0000' });

    const [, insertParams] = pool.query.mock.calls[0];
    expect(insertParams).toEqual([
      'cal-1', null, 'Битва за Гарію', null, '#ff0000', true, null, null, null, 'none',
      null, null, null, null, null,
    ]);
    expect(pool.query.mock.calls[1][0]).toMatch(/DELETE FROM chronology.calendar_event_participants/);
    expect(pool.query.mock.calls[1][1]).toEqual(['e1']);
    expect(pool.query).toHaveBeenCalledTimes(2); // delete only, no insert — no participants given
    expect(event).toEqual({ id: 'e1', participant_ids: [] });
  });

  it('passes through place/duration/participants fields', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'e1' }] });
    await ChronologyEventModel.create('cal-1', {
      name: 'Облога Гарії', color: '#4caf50', year: 100, month_id: 'm1', day: 1,
      location_id: 'loc-1', end_year: 100, end_month_id: 'm2', end_day: 5,
      participant_ids: ['npc-1', 'npc-2'],
    });

    const [, insertParams] = pool.query.mock.calls[0];
    expect(insertParams).toEqual([
      'cal-1', null, 'Облога Гарії', null, '#4caf50', true, 100, 'm1', 1, 'none',
      'loc-1', null, 100, 'm2', 5,
    ]);
    expect(pool.query.mock.calls[2][0]).toMatch(/INSERT INTO chronology.calendar_event_participants/);
    expect(pool.query.mock.calls[2][1]).toEqual(['e1', 'npc-1', 'npc-2']);
  });
});

describe('ChronologyEventModel.update/delete', () => {
  it('scope by id and calendar_id together, and returns null without touching participants on a miss', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const result = await ChronologyEventModel.update('e1', 'cal-1', { name: 'x', color: '#000000' });
    expect(pool.query.mock.calls[0][0]).toMatch(/WHERE id=\$1 AND calendar_id=\$2/);
    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);

    pool.query.mockResolvedValue({ rowCount: 1 });
    await expect(ChronologyEventModel.delete('e1', 'cal-1')).resolves.toBe(true);
    expect(pool.query.mock.calls[1][0]).toMatch(/WHERE id=\$1 AND calendar_id=\$2/);
  });
});
