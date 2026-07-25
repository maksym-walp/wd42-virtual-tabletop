import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Marker types (label / level / icon) live in a user-editable config at
// public/map-markers/types.json — fetched at runtime so authors can add types
// and icons without touching the code. BUILT_IN is the fallback until it loads.
const DEFAULT_LEVEL = 4;
const BUILT_IN = {
  defaultLevel: DEFAULT_LEVEL,
  types: [
    { key: 'capital', label: 'Столиця', level: 4, emoji: '🏛️', icon: '' },
    { key: 'city', label: 'Місто', level: 3, emoji: '🏰', icon: '' },
    { key: 'town', label: 'Містечко', level: 2, emoji: '🏘️', icon: '' },
    { key: 'village', label: 'Село', level: 1, emoji: '🏚️', icon: '' },
  ],
};

const MarkerTypesContext = createContext(null);

const clampLevel = (level, fallback) => {
  const n = Number(level);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(4, Math.max(1, Math.round(n)));
};

function buildApi({ types, defaultLevel }) {
  const byKey = new Map(types.map((t) => [t.key, t]));

  // Resolves a type key to a normalized meta object; unknown/null keys fall back.
  const metaFor = (key) => {
    const t = key ? byKey.get(key) : null;
    if (t) return { ...t, level: clampLevel(t.level, defaultLevel) };
    return { key: key || 'other', label: key && key !== 'other' ? key : 'Інше', level: defaultLevel, emoji: '📍', icon: '' };
  };

  const iconUrl = (meta) => (meta.icon ? `/map-markers/${String(meta.icon).replace(/^\/+/, '')}` : null);

  return { types, defaultLevel, byKey, metaFor, iconUrl };
}

export function MarkerTypesProvider({ children }) {
  const [config, setConfig] = useState(BUILT_IN);

  useEffect(() => {
    let alive = true;
    fetch('/map-markers/types.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data || !Array.isArray(data.types)) return;
        setConfig({ types: data.types, defaultLevel: clampLevel(data.defaultLevel, DEFAULT_LEVEL) });
      })
      .catch(() => { /* keep BUILT_IN */ });
    return () => { alive = false; };
  }, []);

  const api = useMemo(() => buildApi(config), [config]);
  return <MarkerTypesContext.Provider value={api}>{children}</MarkerTypesContext.Provider>;
}

export const useMarkerTypes = () => useContext(MarkerTypesContext);

// Level -> minimum zoom fraction (0..1) at which a marker appears. Level 4 is
// always visible; each lower level needs +25% more zoom (25% tiers).
export function levelThreshold(level) {
  return (4 - clampLevel(level, DEFAULT_LEVEL)) * 0.05;
}
