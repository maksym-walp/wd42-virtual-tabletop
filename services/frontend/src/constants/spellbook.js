export const MAGIC_TYPES = {
  arcana:    { label: 'Аркана',       color: '#4a3d66', bg: 'rgba(74,61,102,0.12)' },
  elemental: { label: 'Стихійна',     color: '#2e5240', bg: 'rgba(46,82,64,0.12)' },
  integral:  { label: 'Інтегральна',  color: '#8a5a2b', bg: 'rgba(138,90,43,0.12)' },
  infernal:  { label: 'Інфернальна',  color: '#7a3320', bg: 'rgba(122,51,32,0.12)' },
  blight:    { label: 'Скверна',      color: '#5a3358', bg: 'rgba(90,51,88,0.12)' },
};

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
