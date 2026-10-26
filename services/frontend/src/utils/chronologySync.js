// Синхронізація календарів: усі вони пов'язані зі спільною «світовою» віссю днів
// через sync_offset_days (міграція 98): світовий_день = день_у_календарі −
// зсув, де день_у_календарі — totalDaysSinceEpoch. Календар за замовчуванням
// завжди на осі (зсув 0, якщо не задано); решта — лише якщо їм задали зсув.
// Цим користуються сітка (події інших календарів на цьому), підказки «яка це
// дата в іншому календарі» та експорт подій.
//
// «Календар» тут — рядок з chronologyApi.list(): окрім полів календаря він
// несе preview_months/preview_weekdays (структура без запитів). Для відкритого
// календаря сторінка підставляє повні months/weekdayCount (поле months має
// пріоритет над preview_months).
import {
  totalDaysSinceEpoch, daysPerYear, eventOccursOnDay, eventHasEnd, eventDayRange,
} from './chronologyMath';
import {
  monthsOf, weekdayCountOf, dateFromTotalDays, makeTimeline,
} from './chronologyEras';

export { monthsOf, weekdayCountOf, dateFromTotalDays };

export const isSynced = (cal) => Boolean(cal?.is_default) || cal?.sync_offset_days != null;
export const calendarOffset = (cal) => Number(cal?.sync_offset_days ?? 0);

// Підпис дати в локальному відліку календаря (з ерами). date — з
// dateFromTotalDays (несе total — день базового відліку).
export function dateLabel(cal, date) {
  return makeTimeline(cal).format(date.total);
}

// Дата { year, monthId, day } одного синхронізованого календаря → дата іншого.
// null — якщо хтось із двох не синхронізований, дата неповна або чужий місяць.
export function convertDate(fromCal, toCal, date) {
  if (!isSynced(fromCal) || !isSynced(toCal) || !date || date.year == null || date.day == null) return null;
  const fromMonths = monthsOf(fromCal);
  const mi = fromMonths.findIndex((m) => m.id === date.monthId);
  if (mi === -1) return null;
  const total = totalDaysSinceEpoch(fromMonths, Number(date.year), mi, Number(date.day));
  return dateFromTotalDays(monthsOf(toCal), total - calendarOffset(fromCal) + calendarOffset(toCal));
}

// Та сама мить в усіх інших синхронізованих календарях: [{ calendar, date, label }].
export function equivalentDates(calendars, fromCal, date) {
  if (!isSynced(fromCal)) return [];
  return calendars
    .filter((c) => c.id !== fromCal.id && isSynced(c))
    .map((c) => {
      const d = convertDate(fromCal, c, date);
      return d && { calendar: c, date: d, label: dateLabel(c, d) };
    })
    .filter(Boolean);
}

// Текст для підказки (title/Tooltip): «Назва: дата» рядок на календар.
export function equivalentDatesText(calendars, fromCal, date) {
  return equivalentDates(calendars, fromCal, date).map((e) => `${e.calendar.name}: ${e.label}`).join('\n');
}

// Події, що припадають на день T (базового відліку) відкритого календаря.
// ctx.targetTimeline — makeTimeline відкритого календаря, ctx.target — він сам.
// Повторюваність рахується за структурою календаря-власника події: день
// переводимо у його дату (через світову вісь), далі — звичайний
// eventOccursOnDay; дні тижня — за локальним відліком власника (ери). Тож
// «щорічна» подія календаря з 360-денним роком коректно повторюється й на сітці
// календаря з 364-денним.
export function eventsOnDay(events, ctx, T) {
  const { calendarsById, target, targetTimeline } = ctx;
  if (!ctx.timelines) ctx.timelines = new Map();
  const world = T - calendarOffset(target);
  const cache = new Map();

  const cellFor = (ownerId) => {
    if (cache.has(ownerId)) return cache.get(ownerId);
    let result = null;
    let tl = null;
    let ownerT = T;
    let ownerCal = target;
    if (ownerId === target.id) {
      tl = targetTimeline;
    } else {
      const owner = calendarsById.get(ownerId);
      if (owner && isSynced(owner) && isSynced(target)) {
        ownerCal = owner;
        if (!ctx.timelines.has(ownerId)) ctx.timelines.set(ownerId, makeTimeline(owner));
        tl = ctx.timelines.get(ownerId);
        ownerT = world + calendarOffset(owner);
      }
    }
    if (tl) {
      const d = dateFromTotalDays(tl.months, ownerT);
      if (d) {
        result = {
          cell: {
            year: d.year, monthId: d.monthId, day: d.day, weekdayIndex: tl.weekdayAt(ownerT),
            total: ownerT, moons: ownerCal.moons || ownerCal.preview_moons || [],
          },
          tl,
        };
      }
    }
    cache.set(ownerId, result);
    return result;
  };

  return events.filter((e) => {
    const c = cellFor(e.calendar_id ?? target.id);
    return c && eventOccursOnDay(e, c.cell, c.tl.months, 0, c.tl.weekdayCount, c.tl.weekdayAt);
  });
}

// Подія в датах іншого календаря (початок і кінець); для власної події чи
// неповної дати — null/сама подія. Повторюваність не змінюється: це лише
// «опорна» дата для підпису.
export function eventInCalendar(event, ownerCal, targetCal) {
  if (!ownerCal || ownerCal.id === targetCal.id) return event;
  const range = eventDayRange(event, monthsOf(ownerCal));
  if (!range || !isSynced(ownerCal) || !isSynced(targetCal)) return null;
  const tMonths = monthsOf(targetCal);
  const shift = calendarOffset(targetCal) - calendarOffset(ownerCal);
  const start = dateFromTotalDays(tMonths, range[0] + shift);
  if (!start) return null;
  const hasEnd = eventHasEnd(event);
  const end = hasEnd ? dateFromTotalDays(tMonths, range[1] + shift) : null;
  return {
    ...event,
    year: start.year, month_id: start.monthId, day: start.day,
    end_year: end ? end.year : null, end_month_id: end ? end.monthId : null, end_day: end ? end.day : null,
  };
}

// Ключ хронологічного сортування події на світовій осі (початок); без дати —
// Infinity (в кінець за будь-якого напрямку), як eventSortKey.
export function eventWorldSortKey(event, calendarsById) {
  const owner = calendarsById.get(event.calendar_id);
  if (!owner || event.year == null) return Infinity;
  const months = monthsOf(owner);
  const mi = months.findIndex((m) => m.id === event.month_id);
  if (mi === -1) return Infinity;
  return totalDaysSinceEpoch(months, Number(event.year), mi, Number(event.day) || 1) - calendarOffset(owner);
}

// Однакові назви розрізняються суфіксом « (2)» — так само, як у структурному
// експорті (chronology/src/lib/calendar-export.js), щоб місяць з експорту подій
// можна було знайти в експорті структури.
export function uniqueNames(names) {
  const seen = new Map();
  return names.map((name) => {
    const n = (seen.get(name) || 0) + 1;
    seen.set(name, n);
    return n === 1 ? name : `${name} (${n})`;
  });
}

// JSON подій з прив'язкою до календаря за замовчуванням: `start`/`end` — дати
// в ньому (month — назва, epoch_day — день від початку його епохи), `origin` —
// як подію задано у власному календарі (за чиєю структурою вона повторюється).
// Для повторюваних подій recurrence_period_days — період власного календаря
// (рік для yearly, тиждень для weekly): у «чужому» календарі він інший.
// events — плоский список подій усіх календарів; plainText — HTML → текст.
export function buildEventsExport({ calendars, events, locationsById, charactersById, plainText }) {
  const byId = new Map(calendars.map((c) => [c.id, c]));
  const base = calendars.find((c) => c.is_default) || null;
  const monthNamesOf = new Map(calendars.map((c) => [c.id, uniqueNames(monthsOf(c).map((m) => m.name))]));
  const monthName = (cal, monthId) => {
    const i = monthsOf(cal).findIndex((m) => m.id === monthId);
    return i === -1 ? null : monthNamesOf.get(cal.id)[i];
  };

  const mapDate = (cal, d) => d && ({
    year: d.year, month: monthName(cal, d.monthId), day: d.day,
    epoch_day: totalDaysSinceEpoch(monthsOf(cal), d.year, monthsOf(cal).findIndex((m) => m.id === d.monthId), d.day),
  });

  const out = events.map((e) => {
    const owner = byId.get(e.calendar_id);
    const hasEnd = eventHasEnd(e);
    const inBase = owner && base ? eventInCalendar(e, owner, base) : null;
    const dateIn = (cal, ev, prefix) => {
      const key = (k) => (prefix ? `${prefix}${k}` : k);
      if (ev[key('year')] == null || !ev[key('month_id')] || ev[key('day')] == null) return null;
      return mapDate(cal, { year: Number(ev[key('year')]), monthId: ev[key('month_id')], day: Number(ev[key('day')]) });
    };
    const originStart = owner ? dateIn(owner, e, '') : null;
    // end_* у власному календарі можуть бути частково порожні — добудовуємо
    // з початку через eventDayRange (як і для підпису).
    let originEnd = null;
    if (owner && hasEnd) {
      const range = eventDayRange(e, monthsOf(owner));
      const d = range && dateFromTotalDays(monthsOf(owner), range[1]);
      originEnd = d && mapDate(owner, d);
    }
    const moon = owner && e.recurrence === 'lunar'
      ? (owner.preview_moons || []).find((m) => m.id === e.moon_id) : null;
    const interval = e.recurrence === 'interval_days' || e.recurrence === 'lunar' ? Number(e.recurrence_interval) || null : null;
    const period = owner && e.recurrence === 'yearly' ? daysPerYear(monthsOf(owner))
      : owner && e.recurrence === 'weekly' ? weekdayCountOf(owner)
        : e.recurrence === 'interval_days' ? interval
          : moon && interval ? interval * Number(moon.cycle_length) : null;
    return {
      name: e.name,
      description: plainText ? plainText(e.description) : (e.description || ''),
      color: e.color,
      recurrence: e.recurrence,
      recurrence_period_days: period,
      recurrence_interval: interval,
      moon: moon ? moon.name : null,
      moon_phase: moon && e.moon_phase != null ? Number(e.moon_phase) : null,
      duration_display: hasEnd ? e.duration_display : null,
      start: owner && base && owner.id === base.id ? originStart : (inBase ? dateIn(base, inBase, '') : null),
      end: !hasEnd ? null
        : (owner && base && owner.id === base.id ? originEnd : (inBase ? dateIn(base, inBase, 'end_') : null)),
      origin: owner ? {
        calendar: owner.name,
        start: originStart,
        end: originEnd,
      } : null,
      location: e.location_id ? (locationsById.get(e.location_id)?.name ?? null) : null,
      region: e.region || null,
      participants: (e.participant_ids || []).map((id) => charactersById.get(id)).filter(Boolean),
      is_public: e.is_public,
      campaign_id: e.campaign_id || null,
    };
  });

  return {
    calendar: base ? base.name : null,
    year_len: base ? daysPerYear(monthsOf(base)) : null,
    events: out,
  };
}
