export const NATURE_TYPES = {
  arcana:    { label: 'Аркана',       color: '#4a3d66', bg: 'rgba(74,61,102,0.12)' },
  elemental: { label: 'Стихійна',     color: '#2e5240', bg: 'rgba(46,82,64,0.12)' },
  integral:  { label: 'Інтегральна',  color: '#8a5a2b', bg: 'rgba(138,90,43,0.12)' },
  infernal:  { label: 'Інфернальна',  color: '#7a3320', bg: 'rgba(122,51,32,0.12)' },
  blight:    { label: 'Скверна',      color: '#5a3358', bg: 'rgba(90,51,88,0.12)' },
};

// Lightened hues of NATURE_TYPES for legibility against the dark-theme
// surface — same keys/labels, picked via useTheme() at the call site.
export const NATURE_TYPES_DARK = {
  arcana:    { label: 'Аркана',       color: '#a78bda', bg: 'rgba(167,139,218,0.12)' },
  elemental: { label: 'Стихійна',     color: '#7fcf9e', bg: 'rgba(127,207,158,0.12)' },
  integral:  { label: 'Інтегральна',  color: '#d9a066', bg: 'rgba(217,160,102,0.12)' },
  infernal:  { label: 'Інфернальна',  color: '#e0836a', bg: 'rgba(224,131,106,0.12)' },
  blight:    { label: 'Скверна',      color: '#b97eb0', bg: 'rgba(185,126,176,0.12)' },
};

// A spell can now have multiple natures at once — these read the first
// entry as the "primary" one wherever the UI only has room for a single
// color/label (card borders, accent colors), and join all of them for
// full-text display. Pass the theme-picked map so the picked color/bg
// matches the active theme (defaults to light for back-compat).
export function primaryNature(nature, natureTypes = NATURE_TYPES) {
  return natureTypes[nature?.[0]] || natureTypes.arcana;
}

export function natureLabels(nature) {
  return (nature || []).map((n) => NATURE_TYPES[n]?.label ?? n).join(', ');
}

export const COMPONENT_UNITS = ['шт.', 'г', 'мг', 'унції', 'краплі', 'щіпки', 'флакони', 'жмені', 'пучки'];
export const CUSTOM_UNIT = '__custom__';

export const RITUAL_TYPES = {
  impossible: { label: 'Неможливий', symbol: '✗' },
  possible:   { label: 'Можливий',   symbol: '◈' },
  required:   { label: 'Необхідний', symbol: '✦' },
};

export const DURATION_UNITS = {
  instant:   'Мить',
  seconds:   'сек.',
  minutes:   'хв.',
  hours:     'год.',
  days:      'дн.',
  permanent: 'Постійно',
};

export const SPELL_KINDS = {
  ranged:    { label: 'Дальнобійне' },
  melee:     { label: 'Ближнє'      },
  defensive: { label: 'Захисне'     },
  healing:   { label: 'Лікуюче'     },
  utility:   { label: 'Небойове'    },
  combined:  { label: 'Комбіноване' },
};

export const ACTION_OPTIONS = [
  { value: 1, label: '1 дія'  },
  { value: 2, label: '2 дії'  },
  { value: 3, label: '3 дії'  },
];

export function formatDuration(value, unit) {
  if (!unit || unit === 'instant' || unit === 'permanent') return DURATION_UNITS[unit] || '—';
  return `${value ?? '?'} ${DURATION_UNITS[unit]}`;
}
