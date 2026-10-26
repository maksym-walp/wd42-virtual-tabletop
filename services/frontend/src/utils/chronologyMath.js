// Shared date math for the custom fantasy calendars (chronology service) —
// used by ChronologyView.jsx (grid generation, "active season", event
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

// Чи має подія дату завершення (тривала). Ті самі незалежно-nullable поля, що
// й початок, тож достатньо будь-якого з трьох.
export function eventHasEnd(event) {
  return event.end_year != null || Boolean(event.end_month_id) || event.end_day != null;
}

// Як тривала подія малюється на сітці (events.duration_display):
// 'start' — лише день початку, 'start_end' — день початку й день завершення,
// 'every_day' — кожен день тривалості, 'none' — не малювати взагалі.
export const DURATION_DISPLAY_LABELS = {
  start: 'Лише дата початку',
  start_end: 'Дата початку і завершення',
  every_day: 'Кожен день тривалості',
  none: 'Не показувати в календарі',
};

// [startTotalDays, endTotalDays] одноразової події або null, якщо діапазон не
// визначити (нема повної дати початку, місяць не з цього календаря) чи він
// некоректний (кінець раніше початку). Рік/місяць/день завершення, яких не
// задано, береться від початку — як у eventDateRangeLabel; день завершення
// не виходить за довжину місяця.
export function eventDayRange(event, months) {
  if (event.year == null || !event.month_id || event.day == null) return null;
  const startMi = months.findIndex((m) => m.id === event.month_id);
  if (startMi === -1) return null;
  const endMi = months.findIndex((m) => m.id === (event.end_month_id || event.month_id));
  if (endMi === -1) return null;
  const endDay = Math.min(Number(event.end_day ?? event.day), Number(months[endMi].length));
  const start = totalDaysSinceEpoch(months, Number(event.year), startMi, Number(event.day));
  const end = totalDaysSinceEpoch(months, Number(event.end_year ?? event.year), endMi, endDay);
  return end >= start ? [start, end] : null;
}

// Does `event` land on this exact grid cell? "yearly"/"monthly"/"weekly"
// ignore the parts of the anchor date that repeat (task: "if yearly, it
// shows on that day/month regardless of the year"). Тривалі події поза
// 'start' режимом (див. DURATION_DISPLAY_LABELS) діють лише для одноразових:
// повторювана подія з кінцем лишається мітками початку, а 'none' ховає
// тривалу подію за будь-якого повторення.
// weekdayAt (необов'язково) — день тижня для базового дня (локальний відлік ер,
// див. chronologyEras.js); без нього — від першого дня року 1 з firstDayOffset.
export function eventOccursOnDay(event, cell, months, firstDayOffset, weekdayCount, weekdayAt) {
  const mode = event.duration_display || 'start';
  const hasEnd = eventHasEnd(event);
  if (mode === 'none' && hasEnd) return false;

  switch (event.recurrence) {
    case 'yearly':
      return event.month_id === cell.monthId && Number(event.day) === cell.day;
    case 'monthly':
      return Number(event.day) === cell.day;
    case 'weekly': {
      if (!weekdayCount) return false;
      if (event.year == null || !event.month_id || event.day == null) return false;
      const anchorMonthIndex = months.findIndex((m) => m.id === event.month_id);
      if (anchorMonthIndex === -1) return false;
      const anchorTotalDays = totalDaysSinceEpoch(months, Number(event.year), anchorMonthIndex, Number(event.day));
      const anchorWeekday = weekdayAt ? weekdayAt(anchorTotalDays) : weekdayIndexOf(anchorTotalDays, firstDayOffset, weekdayCount);
      return anchorWeekday === cell.weekdayIndex;
    }
    case 'none':
    default: {
      const startsHere = Number(event.year) === cell.year && event.month_id === cell.monthId && Number(event.day) === cell.day;
      if (!hasEnd || mode === 'start') return startsHere;
      const range = eventDayRange(event, months);
      if (!range) return startsHere;
      const cellMi = months.findIndex((m) => m.id === cell.monthId);
      if (cellMi === -1) return startsHere;
      const cellTotal = totalDaysSinceEpoch(months, cell.year, cellMi, cell.day);
      if (mode === 'start_end') return cellTotal === range[0] || cellTotal === range[1];
      return cellTotal >= range[0] && cellTotal <= range[1]; // every_day
    }
  }
}

// Вік на «поточну дату» календаря — його default_year/default_month_id (рік і
// місяць, які ChronologyView відкриває за замовчуванням; дня там немає).
// Рахується як прожиті повні роки: різниця років мінус один, якщо день
// народження цього року ще не настав. Без місяця народження (або без
// поточного місяця) — лише різниця років. year — внутрішня суцільна нумерація
// (див. yearLabel), тож перехід між ерами окремо не обробляється.
// null — якщо поточного року немає, рік народження не задано або дата
// народження пізніша за поточну.
export function ageOnCalendarDate(months, birth, now) {
  if (birth?.year == null || birth.year === '' || now?.year == null || now.year === '') return null;
  let age = Number(now.year) - Number(birth.year);
  const birthMi = birth.monthId ? months.findIndex((m) => m.id === birth.monthId) : -1;
  const nowMi = now.monthId ? months.findIndex((m) => m.id === now.monthId) : -1;
  if (birthMi !== -1 && nowMi !== -1) {
    const birthDay = birth.day ? Number(birth.day) : 1;
    const nowDay = now.day ? Number(now.day) : 1;
    if (birthMi > nowMi || (birthMi === nowMi && birthDay > nowDay)) age -= 1;
  }
  return Number.isFinite(age) && age >= 0 ? age : null;
}
