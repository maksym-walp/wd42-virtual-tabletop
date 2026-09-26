// No per-nature accent color — nature is conveyed by its label, not a hue
// (colors are reserved for archetype badges, which map to one specific archetype).
export const NATURE_TYPES = {
  arcana:    { label: 'Аркана' },
  elemental: { label: 'Стихійна' },
  integral:  { label: 'Інтегральна' },
  infernal:  { label: 'Інфернальна' },
  blight:    { label: 'Скверна' },
};

// A spell can have multiple natures at once — this reads the first entry as
// the "primary" one wherever the UI only has room for a single label (card
// headers), and natureLabels() below joins all of them for full-text display.
export function primaryNature(nature) {
  return NATURE_TYPES[nature?.[0]] || NATURE_TYPES.arcana;
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

export const SPELL_COMPLEXITIES = {
  primitive: { label: 'Примітивне' },
  simple:    { label: 'Просте' },
  medium:    { label: 'Середнє' },
  complex:   { label: 'Комплексне' },
  extreme:   { label: 'Надзвичайно складне' },
};

// Поля, що можуть відрізнятися між рівнями заклинання (хронологічними
// версіями). Рівень 1 — колонки самого заклинання, рівні 2..N лежать у
// spell.levels як повні знімки саме цих полів (див. normalizeLevels у
// services/spellbook/src/models/spell.model.js).
export const LEVEL_FIELDS = [
  'complexity', 'spell_kind', 'energy_cost', 'action_time', 'ritual',
  'duration_value', 'duration_unit', 'range_desc', 'components',
  'mechanical_desc', 'narrative_desc', 'lore_creator', 'lore_creator_npc_id',
];

export function pickLevelFields(source) {
  return Object.fromEntries(LEVEL_FIELDS.map((f) => [f, source[f]]));
}

// Усі рівні заклинання одним масивом: [рівень 1 (з колонок), ...spell.levels].
export function spellLevels(spell) {
  return [pickLevelFields(spell), ...(spell.levels || [])];
}

// Заклинання з полями конкретного рівня (1-based) поверх спільних — для
// місць, що показують те, чим персонаж уже оволодів. Рівень поза межами
// обрізається до найближчого наявного.
export function spellAtLevel(spell, level = 1) {
  const levels = spellLevels(spell);
  const idx = Math.min(Math.max(level, 1), levels.length) - 1;
  return { ...spell, ...levels[idx] };
}
