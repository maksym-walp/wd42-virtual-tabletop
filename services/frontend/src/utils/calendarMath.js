// Shared date math for the custom fantasy calendars (calendar service) —
// used by CalendarView.jsx (grid generation, "active season", event
// recurrence) and MoonPhase.jsx (phase-from-day-count).
//
// Convention: "day 1 of year 1" is the epoch. total_days_since_epoch is a
// zero-indexed, signed day count relative to it (negative for years in the
// calendar's previous_era_name, since a "year 0" doesn't exist — see
// yearLabel below). `months` is always the calendar's own months array,
// already ordered by order_num (as returned by GET /:id/months).

// Safe modulo — JS's `%` returns a negative result for a negative dividend
// (e.g. -1 % 7 === -1), which is wrong for wrap-around day/weekday math.
export function mod(n, m) {
  return ((n % m) + m) % m;
}

export function daysPerYear(months) {
  return months.reduce((sum, m) => sum + Number(m.length), 0);
}

// Sum of the lengths of every month before monthIndex (0-based) within a
// single year — i.e. how many days into the year month `monthIndex` starts.
export function daysBeforeMonth(months, monthIndex) {
  return months.slice(0, monthIndex).reduce((sum, m) => sum + Number(m.length), 0);
}

// day is 1-based (the 1st day of a month is day=1).
export function totalDaysSinceEpoch(months, year, monthIndex, day) {
  return (year - 1) * daysPerYear(months) + daysBeforeMonth(months, monthIndex) + (day - 1);
}

// Task's formula: (total days since year 1 day 1) + first_day_offset, mod
// the number of weekdays.
export function weekdayIndexOf(totalDays, firstDayOffset, weekdayCount) {
  if (!weekdayCount) return 0;
  return mod(totalDays + Number(firstDayOffset), weekdayCount);
}

// There is no year 0: year >= 1 counts up in current_era_name, year <= 0
// counts up in previous_era_name (year 0 = "1 <previous era>", matching the
// common BC/AD-style convention where the era boundary itself has no zero).
export function yearLabel(year, currentEraName, previousEraName) {
  if (year >= 1) return `${year}${currentEraName ? ` ${currentEraName}` : ''}`;
  return `${1 - year}${previousEraName ? ` ${previousEraName}` : ''}`;
}

// Which season is "in effect" for a given day-of-year: the season whose
// start (month, day) is the latest one at-or-before it, wrapping around to
// the season that started latest in the previous year if the requested day
// falls before every season's start. Seasons only carry a *start* marker
// (no end) — this is what makes one "active" without needing one.
export function getActiveSeason(seasons, months, monthIndex, day = 1) {
  if (seasons.length === 0) return null;
  const targetDayOfYear = daysBeforeMonth(months, monthIndex) + (day - 1);

  const withDayOfYear = seasons.map((s) => {
    const startMonthIndex = months.findIndex((m) => m.id === s.start_month_id);
    const startDayOfYear = startMonthIndex === -1
      ? 0
      : daysBeforeMonth(months, startMonthIndex) + (Number(s.start_day) - 1);
    return { season: s, startDayOfYear };
  }).sort((a, b) => a.startDayOfYear - b.startDayOfYear);

  const candidates = withDayOfYear.filter((s) => s.startDayOfYear <= targetDayOfYear);
  const chosen = candidates.length > 0 ? candidates[candidates.length - 1] : withDayOfYear[withDayOfYear.length - 1];
  return chosen.season;
}

// Does `event` land on this exact grid cell? "yearly"/"monthly"/"weekly"
// ignore the parts of the anchor date that repeat (task: "if yearly, it
// shows on that day/month regardless of the year").
export function eventOccursOnDay(event, cell, months, firstDayOffset, weekdayCount) {
  switch (event.recurrence) {
    case 'yearly':
      return event.month_id === cell.monthId && Number(event.day) === cell.day;
    case 'monthly':
      return Number(event.day) === cell.day;
    case 'weekly': {
      if (event.year == null || !event.month_id || event.day == null) return false;
      const anchorMonthIndex = months.findIndex((m) => m.id === event.month_id);
      if (anchorMonthIndex === -1) return false;
      const anchorTotalDays = totalDaysSinceEpoch(months, Number(event.year), anchorMonthIndex, Number(event.day));
      const anchorWeekday = weekdayIndexOf(anchorTotalDays, firstDayOffset, weekdayCount);
      return anchorWeekday === cell.weekdayIndex;
    }
    case 'none':
    default:
      return Number(event.year) === cell.year && event.month_id === cell.monthId && Number(event.day) === cell.day;
  }
}
