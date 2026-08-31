// Marker icons are per-location: either an uploaded image URL or an emoji.
// There is no shared type/icon config file anymore.

export const UNTYPED_KEY = 'other';
export const DEFAULT_MARKER_LEVEL = 4;

// Bucket keys for a location's type SET: real values pass through (deduped),
// an empty set collapses to the single UNTYPED_KEY.
export function typeKeysOf(types) {
  const list = (Array.isArray(types) ? types : []).map((t) => t || '').filter(Boolean);
  return list.length ? [...new Set(list)] : [UNTYPED_KEY];
}

// A marker icon value is an image URL when it looks like a path/URL; otherwise
// it's treated as an emoji glyph.
export function isIconUrl(value) {
  return typeof value === 'string' && (value.startsWith('/') || value.startsWith('http'));
}

// Level -> minimum zoom fraction (0..1) at which a marker appears. Level 4 is
// always visible; each lower level needs more zoom.
export function levelThreshold(level) {
  const n = Math.min(4, Math.max(1, Math.round(Number(level) || DEFAULT_MARKER_LEVEL)));
  return (4 - n) * 0.05;
}

// ---- Timeline: lens versions over the years ------------------------------

// The distinct years that have a version image, ascending. A lens's "timeless"
// version (year === null) is not a point on the timeline.
export function datedYears(versions) {
  const years = (versions || []).map((v) => v.year).filter((y) => y != null);
  return [...new Set(years)].sort((a, b) => a - b);
}

// The image_url to show for `year` (a number, or null when there is no active
// year): the newest version at or before `year`; before the first dated
// version, the earliest one; with no dated versions, the timeless one.
export function resolveLensImage(versions, year) {
  if (!versions?.length) return null;
  const dated = versions.filter((v) => v.year != null).sort((a, b) => a.year - b.year);
  if (!dated.length) return versions[0].image_url; // timeless-only lens
  if (year == null) return dated[dated.length - 1].image_url;
  let pick = dated[0];
  for (const v of dated) if (v.year <= year) pick = v;
  return pick.image_url;
}

// A pin exists in `year` when the year falls inside its [start_year, end_year]
// window (either bound null = unbounded that way). year === null (no active
// year) means "show everything".
export function pinVisibleInYear(pin, year) {
  if (year == null) return true;
  if (pin.start_year != null && year < pin.start_year) return false;
  if (pin.end_year != null && year > pin.end_year) return false;
  return true;
}

// The dated version "governing" `year`: the latest one whose start_year is at
// or before `year`. null when `year` is before every dated version (or unset).
// `versions` is dated-only, ascending (matches the compact per-pin
// `location_versions` the map endpoint returns).
export function datedVersionAt(versions, year) {
  if (year == null || !versions?.length) return null;
  let pick = null;
  for (const v of versions) {
    if (v.start_year != null && v.start_year <= year) pick = v;
  }
  return pick;
}

// A pin's location exists at `year` iff it has been "born" (a dated version has
// started) and not "ended" (the governing version's end_year, if set, hasn't
// passed — this also covers gaps before the next version). Locations with no
// dated versions always exist.
export function pinExistsInYear(pin, year) {
  if (year == null) return true;
  const vs = pin.location_versions;
  if (!vs?.length) return true;
  if (year < vs[0].start_year) return false; // not born yet
  const gov = datedVersionAt(vs, year);
  if (gov && gov.end_year != null && year > gov.end_year) return false; // ended / gap
  return true;
}

// The chronological version of a location to show for `year`: the version
// governing that year while its [start, end] window still holds; once a
// version has ended it falls back to the base (start_year === null) version.
// With no year / no dated version → base, then the earliest dated one.
export function resolveLocationVersion(versions, year) {
  if (!versions?.length) return null;
  const base = versions.find((v) => v.start_year == null) || null;
  if (year != null) {
    const gov = datedVersionAt(versions, year);
    if (gov) {
      if (gov.end_year == null || year <= gov.end_year) return gov;
      return base || gov;
    }
  }
  const dated = versions
    .filter((v) => v.start_year != null)
    .sort((a, b) => a.start_year - b.start_year);
  return base || dated[0] || null;
}

// A pin's effective marker at `year`: per-version override wins, else the base
// (location_name / location_marker_icon / location_marker_level on the pin row).
export function resolvePinMarker(pin, year) {
  const v = datedVersionAt(pin.location_versions, year);
  return {
    name: v?.name ?? pin.location_name,
    icon: v?.marker_icon ?? pin.location_marker_icon,
    level: v?.marker_level ?? pin.location_marker_level,
  };
}

// A pin's effective type bucket keys at `year`: a version's `types` override
// (non-null, may be []) wins over the base `location_types`.
export function resolvePinTypeKeys(pin, year) {
  const v = datedVersionAt(pin.location_versions, year);
  const types = (v && v.types != null) ? v.types : pin.location_types;
  return typeKeysOf(types);
}
