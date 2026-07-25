// Marker-type metadata (labels, levels, icons) now lives in the user-editable
// config at public/map-markers/types.json, exposed via MarkerTypesContext.
// This module keeps only the type-key bucketing used for filtering.

export const UNTYPED_KEY = 'other';

// Stable bucket key: real type values pass through, null/empty collapse to UNTYPED_KEY.
export function typeKey(type) {
  return type || UNTYPED_KEY;
}
