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

// Початковий набір видів заклинань — актуальний список редагується з
// адмін-панелі (spell_kinds) і читається через hooks/useSpellKinds.js; ця
// константа лише показується, доки він не завантажився.
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

// Поля, що можуть відрізнятися між формами заклинання. Основна форма —
// колонки самого заклинання, додаткові лежать у spell.forms як повні
// знімки саме цих полів + { kind, id, name } (див. normalizeForms у
// services/spellbook/src/models/spell.model.js).
export const FORM_FIELDS = [
  'complexity', 'spell_kind', 'energy_cost', 'action_time', 'ritual',
  'duration_value', 'duration_unit', 'range_desc', 'components',
  'mechanical_desc', 'narrative_desc', 'lore_creator', 'lore_creator_npc_id',
];

export function pickFormFields(source) {
  return Object.fromEntries(FORM_FIELDS.map((f) => [f, source[f]]));
}

// Рівневі форми по зростанню. 'full' — це основна форма заклинання, коли
// в нього є хоч одна інша рівнева (primitive/perfected у spell.forms).
export const FORM_TIERS = {
  primitive: { label: 'Примітивна форма' },
  full:      { label: 'Повноцінна форма' },
  perfected: { label: 'Довершена форма' },
};

export function hasTierForms(spell) {
  return (spell?.forms || []).some((f) => f.kind === 'primitive' || f.kind === 'perfected');
}

// Заклинання має або рівневі форми, або основну + альтернативні — не
// обидва типи разом (сервер відхиляє змішування).
export function spellFormMode(spell) {
  return hasTierForms(spell) ? 'tiered' : 'alternative';
}

export const DEFAULT_MAIN_FORM_NAME = 'Основна форма';

export function mainFormLabel(spell) {
  return hasTierForms(spell) ? FORM_TIERS.full.label : (spell?.main_form_name?.trim() || DEFAULT_MAIN_FORM_NAME);
}

// Наявні рівневі форми заклинання по зростанню: ['primitive', 'full', ...];
// [] — якщо рівневих форм немає.
export function spellTiers(spell) {
  if (!hasTierForms(spell)) return [];
  const kinds = (spell.forms || []).map((f) => f.kind);
  return Object.keys(FORM_TIERS).filter((t) => t === 'full' || kinds.includes(t));
}

// Усі форми заклинання одним списком у порядку показу: рівневі (примітивна,
// основна/повноцінна, довершена), далі альтернативні. key — стабільний ключ
// ('main', 'primitive', 'perfected' або uuid альтернативної).
export function spellForms(spell) {
  const extra = spell.forms || [];
  const tier = (kind) => extra.filter((f) => f.kind === kind)
    .map((f) => ({ ...f, key: f.kind, label: FORM_TIERS[f.kind].label }));
  return [
    ...tier('primitive'),
    { ...pickFormFields(spell), key: 'main', kind: 'main', label: mainFormLabel(spell) },
    ...tier('perfected'),
    ...extra.filter((f) => f.kind === 'alternative').map((f) => ({ ...f, key: f.id, label: f.name })),
  ];
}

// Альтернативні форми для вибору персонажем: основна + альтернативні.
export function spellVariantForms(spell) {
  return spellForms(spell).filter((f) => f.kind === 'main' || f.kind === 'alternative');
}

// Заклинання з полями форми, якою персонаж користується: обрана основна
// (primary_form); для основної форми заклинання з рівневими формами —
// рівнева форма, до якої персонаж дійшов (form_tier).
export function spellForCharacter(spell, { primary_form = 'main', form_tier } = {}) {
  const forms = spellForms(spell);
  let key = forms.some((f) => f.key === primary_form) ? primary_form : 'main';
  if (key === 'main' && form_tier && form_tier !== 'full' && forms.some((f) => f.key === form_tier)) key = form_tier;
  const form = forms.find((f) => f.key === key);
  return { ...spell, ...pickFormFields(form), form_label: form.label };
}
