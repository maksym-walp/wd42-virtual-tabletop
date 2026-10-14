// Ери календаря (chronology.calendar_eras, міграція 99) — накладка над
// безперервним «базовим» відліком, у якому збережено всі дати.
//
// Базовий відлік: день 1 року 1 = 0, totalDaysSinceEpoch; саме так зберігаються
// дати подій, НІП, кампаній. Ера починається в заданий день S цього відліку, і з
// нього «локальний» відлік іде наново з 1: рік, місяць, день місяця, день тижня
// (зсув першого дня року діє лише до першої ери). Супутники не переривається —
// вони рахуються за базовим днем. Ера триває до початку наступної; циклічна ера
// (cycle_years) повторюється циклами по стільки років, у кожному відлік знову з 1.
// До першої ери діє «основний» відлік: роки ≥ 1 — current_era_name, роки ≤ 0 —
// previous_era_name (див. yearLabel). Календар без ер поводиться як і раніше.
import {
  daysPerYear, daysBeforeMonth, totalDaysSinceEpoch, mod, yearLabel,
} from './chronologyMath';

// «Календар» — рядок chronologyApi.list()/getOne() (структура в preview_*) або
// об'єкт сторінки з повними months/eras/weekdayCount, які мають пріоритет.
export const monthsOf = (cal) => cal.months || cal.preview_months || [];
export const weekdayCountOf = (cal) => cal.weekdayCount ?? cal.weekday_count ?? (cal.preview_weekdays || []).length;
export const erasOf = (cal) => cal.eras || cal.preview_eras || [];

// Зворотне до totalDaysSinceEpoch: день від початку епохи → дата базового
// відліку { year, monthIndex, monthId, monthName, day, total }; null без місяців.
export function dateFromTotalDays(months, total) {
  const yearLen = daysPerYear(months);
  if (!yearLen) return null;
  const year = Math.floor(total / yearLen) + 1;
  let rest = mod(total, yearLen);
  for (let i = 0; i < months.length; i++) {
    const len = Number(months[i].length);
    if (rest < len) {
      return { year, monthIndex: i, monthId: months[i].id, monthName: months[i].name, day: rest + 1, total };
    }
    rest -= len;
  }
  return null;
}

export function makeTimeline(cal) {
  const months = monthsOf(cal);
  const yearLen = daysPerYear(months);
  const weekdayCount = weekdayCountOf(cal);
  const firstDayOffset = Number(cal.first_day_offset) || 0;

  const eras = erasOf(cal)
    .map((e) => {
      const mi = months.findIndex((m) => m.id === e.start_month_id);
      if (mi === -1) return null;
      return {
        ...e,
        cycle: e.cycle_years ? Number(e.cycle_years) : null,
        startT: totalDaysSinceEpoch(months, Number(e.start_year), mi, Number(e.start_day)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startT - b.startT);

  // Де T у локальному відліку: { eraIndex (-1 — основний), era, cycle, year,
  // monthIndex, monthId, monthName, day, weekday, segStart, segEnd }.
  // segStart/segEnd — межі «сторінки» відліку (ери або її поточного циклу);
  // segEnd включно, Infinity — без кінця.
  function locate(T) {
    if (!yearLen) return null;
    let idx = -1;
    for (let i = 0; i < eras.length && eras[i].startT <= T; i++) idx = i;

    let segStart = -Infinity;
    let segEnd = eras.length ? eras[0].startT - 1 : Infinity;
    let cycle = null;
    let local = T;
    let weekday = weekdayCount ? mod(T + firstDayOffset, weekdayCount) : 0;
    let year;

    if (idx === -1) {
      year = Math.floor(T / yearLen) + 1;
    } else {
      const era = eras[idx];
      const nextStart = idx + 1 < eras.length ? eras[idx + 1].startT : Infinity;
      segStart = era.startT;
      segEnd = nextStart - 1;
      if (era.cycle) {
        const span = era.cycle * yearLen;
        const k = Math.floor((T - era.startT) / span);
        segStart = era.startT + k * span;
        segEnd = Math.min(segStart + span, nextStart) - 1;
        cycle = k + 1;
      }
      local = T - segStart;
      year = Math.floor(local / yearLen) + 1;
      weekday = weekdayCount ? mod(local, weekdayCount) : 0;
    }

    const d = dateFromTotalDays(months, mod(local, yearLen));
    return {
      T, eraIndex: idx, era: idx === -1 ? null : eras[idx], cycle, year,
      monthIndex: d.monthIndex, monthId: d.monthId, monthName: d.monthName, day: d.day,
      weekday, segStart, segEnd,
    };
  }

  const yearText = (loc) => {
    if (!loc.era) return yearLabel(loc.year, cal.current_era_name, cal.previous_era_name);
    return `${loc.year} ${loc.era.name}${loc.cycle ? `, цикл ${loc.cycle}` : ''}`;
  };

  // Локальна дата → день базового відліку (без перевірки меж ери — див. isValidLocal).
  function toAbs({ eraIndex, cycle, year, monthIndex, day }) {
    const inYear = daysBeforeMonth(months, monthIndex) + (day - 1);
    if (eraIndex < 0) return (year - 1) * yearLen + inYear;
    const era = eras[eraIndex];
    const start = era.startT + (era.cycle ? ((cycle || 1) - 1) * era.cycle * yearLen : 0);
    return start + (year - 1) * yearLen + inYear;
  }

  return {
    months, yearLen, weekdayCount, eras, hasEras: eras.length > 0,
    locate,
    yearText,
    weekdayAt: (T) => locate(T)?.weekday ?? 0,
    // «12 Каель, 3 Ера Попелу»
    format(T) {
      const loc = locate(T);
      return loc ? `${loc.day} ${loc.monthName}, ${yearText(loc)}` : '';
    },
    toAbs,
    // Чи справді така локальна дата існує (не виходить за межі ери/циклу, день у
    // місяці) — порівнюємо з тим, що дає locate для обчисленого дня.
    isValidLocal(spec) {
      if (!months[spec.monthIndex] || spec.day < 1 || spec.day > Number(months[spec.monthIndex].length)) return false;
      const loc = locate(toAbs(spec));
      return Boolean(loc) && loc.eraIndex === spec.eraIndex && loc.cycle === (eras[spec.eraIndex]?.cycle ? (spec.cycle || 1) : null)
        && loc.year === spec.year && loc.monthIndex === spec.monthIndex && loc.day === spec.day;
    },
    // Сторінка місяця, що містить T: { loc, start, end, truncated } — end не
    // виходить за кінець ери/циклу; truncated — місяць обірвано початком іншої ери.
    monthPage(T) {
      const loc = locate(T);
      if (!loc) return null;
      const start = T - (loc.day - 1);
      const naturalEnd = start + Number(months[loc.monthIndex].length) - 1;
      const end = Math.min(naturalEnd, loc.segEnd);
      return { loc, start, end, truncated: end < naturalEnd };
    },
  };
}

// Власні назви термінів календаря (міграція 99): називний відмінок, однина.
export const TERM_DEFAULTS = { day: 'День', week: 'Тиждень', season: 'Сезон', year: 'Рік' };
export function termsOf(cal) {
  return {
    day: cal?.term_day || TERM_DEFAULTS.day,
    week: cal?.term_week || TERM_DEFAULTS.week,
    season: cal?.term_season || TERM_DEFAULTS.season,
    year: cal?.term_year || TERM_DEFAULTS.year,
  };
}
