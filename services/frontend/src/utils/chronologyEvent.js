// Small display/sort helpers for chronology events shared between
// ChronologyView.jsx (day sheet) and ChronologyEvents.jsx (the Події tab) —
// kept out of chronologyMath.js since that file is pure calendar date math
// with no notion of "an event" or cross-service data (locations).
import { totalDaysSinceEpoch, yearLabel } from './chronologyMath';

// One side of an event's date (start or end): "day month, year era", falling
// back gracefully as pieces go missing. null when there's no year at all —
// same "as loosely or precisely as the GM knows it" philosophy as the event
// fields themselves.
export function eventDateLabel(months, year, monthId, day, currentEraName, previousEraName) {
  if (year == null) return null;
  const month = months.find((m) => m.id === monthId);
  const dayMonth = [day, month?.name].filter(Boolean).join(' ');
  const yr = yearLabel(year, currentEraName, previousEraName);
  return dayMonth ? `${dayMonth}, ${yr}` : yr;
}

// Full label for an event: just the start, or "start – end" once an end
// date is set (a duration event may leave end_month_id/end_day unset while
// still having an end_year — same independently-nullable shape as the start
// fields, so the end label falls back to the start's month/day if needed).
export function eventDateRangeLabel(event, months, currentEraName, previousEraName) {
  const start = eventDateLabel(months, event.year, event.month_id, event.day, currentEraName, previousEraName);
  if (!start) return 'Дата не вказана';
  const hasEnd = event.end_year != null || event.end_month_id || event.end_day != null;
  if (!hasEnd) return start;
  const end = eventDateLabel(
    months,
    event.end_year ?? event.year,
    event.end_month_id ?? event.month_id,
    event.end_day,
    currentEraName,
    previousEraName
  );
  return end ? `${start} – ${end}` : start;
}

// Resolved place text: a location's name (via the caller's id → location
// map, since the name itself lives in the maps service), the free-text
// region, or null when neither is set — location_id/region are mutually
// exclusive at the DB level, so at most one of these ever applies.
export function eventPlaceLabel(event, locationsById) {
  if (event.location_id) return locationsById.get(event.location_id)?.name || 'Локація (недоступна)';
  if (event.region) return event.region;
  return null;
}

// Chronological sort key (day count since epoch) for an event's start date;
// undated/unpinned events (no year, or a month_id that isn't in this
// calendar's own months) sort last regardless of direction.
export function eventSortKey(event, months) {
  if (event.year == null) return Infinity;
  const monthIndex = months.findIndex((m) => m.id === event.month_id);
  if (monthIndex === -1) return Infinity;
  return totalDaysSinceEpoch(months, Number(event.year), monthIndex, Number(event.day) || 1);
}
