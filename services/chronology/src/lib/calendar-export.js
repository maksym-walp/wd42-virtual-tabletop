// Структура календаря у плоскому JSON для відтворення в іншому рушії
// (місяці/дні тижня/супутники/сезони; події не входять — вони експортуються
// окремо з вкладки «Події», з прив'язкою до календаря за замовчуванням). Формат — як у
// зовнішнього рушія, що парами ключ → значення описує календар: словники
// month_len/lunar_cyc/lunar_shf ключуються назвою, тож однакові назви
// розрізняються суфіксом « (2)», « (3)»... — і в масиві, і в словнику.

function uniqueNames(names) {
  const seen = new Map();
  return names.map((name) => {
    const n = (seen.get(name) || 0) + 1;
    seen.set(name, n);
    return n === 1 ? name : `${name} (${n})`;
  });
}

function buildCalendarExport(calendar, { months, weekdays, seasons, moons, eras = [] }) {
  const monthNames = uniqueNames(months.map((m) => m.name));
  const moonNames = uniqueNames(moons.map((m) => m.name));
  const monthName = new Map(months.map((m, i) => [m.id, monthNames[i]]));

  const monthLen = {};
  months.forEach((m, i) => { monthLen[monthNames[i]] = Number(m.length); });
  const lunarCyc = {};
  const lunarShf = {};
  moons.forEach((m, i) => {
    lunarCyc[moonNames[i]] = Number(m.cycle_length);
    lunarShf[moonNames[i]] = Number(m.shift);
  });

  return {
    year_len: months.reduce((sum, m) => sum + Number(m.length), 0),
    n_months: months.length,
    months: monthNames,
    month_len: monthLen,
    week_len: weekdays.length,
    weekdays: weekdays.map((w) => w.name),
    n_moons: moons.length,
    moons: moonNames,
    lunar_cyc: lunarCyc,
    lunar_shf: lunarShf,
    year: calendar.default_year ?? 1,
    first_day: Number(calendar.first_day_offset) || 0,
    notes: {},
    // Розширення поза базовим форматом — рушії, що його не знають, ігнорують.
    seasons: seasons.map((s) => ({
      name: s.name,
      start_month: monthName.get(s.start_month_id) ?? null,
      start_day: Number(s.start_day),
      color: s.color,
    })),
    // Ери: з початку era відлік років/місяців/днів/днів тижня знову з 1 (крім
    // супутників). start — дата в безперервному відліку (рік 1 = початок);
    // cycle_years != null — циклічна ера (повторюється циклами по стільки років).
    // era_names — основні назви ер для років до першої ери та після.
    eras: eras.map((e) => ({
      name: e.name,
      start: { year: Number(e.start_year), month: monthName.get(e.start_month_id) ?? null, day: Number(e.start_day) },
      cycle_years: e.cycle_years == null ? null : Number(e.cycle_years),
    })),
    era_names: { current: calendar.current_era_name ?? null, previous: calendar.previous_era_name ?? null },
    // Власні назви термінів календаря (null — стандартні).
    terms: {
      day: calendar.term_day ?? null, week: calendar.term_week ?? null, month: calendar.term_month ?? null,
      season: calendar.term_season ?? null, year: calendar.term_year ?? null,
    },
  };
}

module.exports = { buildCalendarExport };
