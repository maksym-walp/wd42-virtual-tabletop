// In-fiction years are plain integers and may be negative (BCE-style). A missing
// value (undefined/null/'') means "no year" — null in the DB — not an error.

// -> { value: int|null } on success, { error } on a malformed value.
function parseYear(value) {
  if (value === undefined || value === null || value === '') return { value: null };
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { error: 'Рік має бути цілим числом' };
  }
  return { value };
}

// Reads start_year / end_year off a request body.
// -> { startYear, endYear } (each int|null) or { error }.
function parseYearRange(body) {
  const start = parseYear(body.start_year);
  if (start.error) return { error: start.error };
  const end = parseYear(body.end_year);
  if (end.error) return { error: end.error };
  if (start.value !== null && end.value !== null && start.value > end.value) {
    return { error: 'Рік початку не може бути пізнішим за рік завершення' };
  }
  return { startYear: start.value, endYear: end.value };
}

module.exports = { parseYear, parseYearRange };
