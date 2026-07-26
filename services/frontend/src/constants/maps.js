// Marker icons are per-location: either an uploaded image URL or an emoji.
// There is no shared type/icon config file anymore.

export const UNTYPED_KEY = 'other';
export const DEFAULT_MARKER_LEVEL = 4;

// Stable bucket key: real category values pass through, null/empty collapse.
export function typeKey(type) {
  return type || UNTYPED_KEY;
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
