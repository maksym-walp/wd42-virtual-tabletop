const { buildCalendarExport } = require('../calendar-export');

const months = [
  { id: 'm1', name: 'Ельран', length: 30 },
  { id: 'm2', name: 'Дракон', length: '31' },
];

describe('buildCalendarExport eras and terms', () => {
  it('exports eras (cyclic or not), era names and custom terms', () => {
    const out = buildCalendarExport(
      { current_era_name: 'Ера Дракона', term_year: 'Оберт', term_month: 'Декада' },
      {
        months, weekdays: [], seasons: [], moons: [],
        eras: [
          { name: 'Попіл', start_year: 500, start_month_id: 'm2', start_day: 3, cycle_years: null },
          { name: 'Цикл', start_year: '900', start_month_id: 'm1', start_day: 1, cycle_years: '60' },
        ],
      },
    );
    expect(out.eras).toEqual([
      { name: 'Попіл', start: { year: 500, month: 'Дракон', day: 3 }, cycle_years: null },
      { name: 'Цикл', start: { year: 900, month: 'Ельран', day: 1 }, cycle_years: 60 },
    ]);
    expect(out.era_names).toEqual({ current: 'Ера Дракона', previous: null });
    expect(out.terms.year).toBe('Оберт');
    expect(out.terms.month).toBe('Декада');
  });
});

describe('buildCalendarExport', () => {
  it('produces the flat engine format', () => {
    const out = buildCalendarExport(
      { default_year: 5, first_day_offset: 2 },
      {
        months,
        weekdays: [{ name: 'Понеділок' }, { name: 'Вівторок' }],
        seasons: [{ name: 'Зима', start_month_id: 'm2', start_day: 3, color: '#ffffff' }],
        moons: [{ name: 'Tverd', cycle_length: 28, shift: 12 }],
      },
    );
    expect(out).toEqual({
      year_len: 61, n_months: 2, months: ['Ельран', 'Дракон'],
      month_len: { Ельран: 30, Дракон: 31 },
      week_len: 2, weekdays: ['Понеділок', 'Вівторок'],
      n_moons: 1, moons: ['Tverd'], lunar_cyc: { Tverd: 28 }, lunar_shf: { Tverd: 12 },
      year: 5, first_day: 2, notes: {},
      seasons: [{ name: 'Зима', start_month: 'Дракон', start_day: 3, color: '#ffffff' }],
      eras: [], era_names: { current: null, previous: null },
      terms: { day: null, week: null, month: null, season: null, year: null },
    });
  });

  it('falls back to year 1 / offset 0 and disambiguates duplicate names', () => {
    const out = buildCalendarExport({}, {
      months: [{ id: 'a', name: 'Той', length: 10 }, { id: 'b', name: 'Той', length: 20 }],
      weekdays: [], seasons: [{ name: 'S', start_month_id: 'b', start_day: 1, color: '#000000' }],
      moons: [{ name: 'L', cycle_length: 29.5, shift: 0 }, { name: 'L', cycle_length: 10, shift: 1 }],
    });
    expect(out.months).toEqual(['Той', 'Той (2)']);
    expect(out.month_len).toEqual({ Той: 10, 'Той (2)': 20 });
    expect(out.moons).toEqual(['L', 'L (2)']);
    expect(out.lunar_cyc).toEqual({ L: 29.5, 'L (2)': 10 });
    expect(out.seasons[0].start_month).toBe('Той (2)');
    expect(out).not.toHaveProperty('events');
    expect(out.year).toBe(1);
    expect(out.first_day).toBe(0);
  });
});

describe('buildCalendarExport unnamed week', () => {
  it('exports numbered weekdays when only the week length is set', () => {
    const out = buildCalendarExport({ week_length: 3 }, { months, weekdays: [], seasons: [], moons: [] });
    expect(out.week_len).toBe(3);
    expect(out.weekdays).toEqual(['1', '2', '3']);
  });
});
