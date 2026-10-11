import {
  FORM_TIERS, DEFAULT_MAIN_FORM_NAME, pickFields, hasTierForms, formModeOf, mainFormLabel,
  entryTiers, entryForms, entryVariantForms, entryForCharacter, entryWithForm,
} from './forms';
import { DURATION_UNITS, formatDuration } from './duration';

// «Форма магії» (колонка spells.nature). Набір ключів фіксований (CHECK у
// БД, міграція 93); назви й описи редагує адмін (admin.site_configs,
// magic_forms) і вони підвантажуються через hooks/useMagicForms.js — тут
// лише початкові назви, доки відповіді ще немає. Колір форми не потрібен:
// форма передається назвою (кольори зарезервовані за бейджами архетипів).
export const NATURE_TYPES = {
  arcana:    { label: 'Аркана' },
  elemental: { label: 'Стихії' },
  integral:  { label: 'Інтеграл' },
  pact:      { label: 'Пакт' },
  nature:    { label: 'Природа' },
  blight:    { label: 'Скверна' },
};

// Серверні назви/описи форм магії (масив {key,label,description}) —
// виставляє useMagicForms, коли вони завантажились чи змінились у адмінці.
// Модульний стан, щоб natureLabels/primaryNature, які викликаються і поза
// компонентами (пошук, меню колекцій), теж віддавали відредаговані назви.
let magicFormsOverride = null;

export function setMagicForms(list) {
  magicFormsOverride = Array.isArray(list) ? list : null;
}

// { label, description } форми за ключем; невідомий ключ показується як є.
export function magicFormInfo(key) {
  const fromServer = magicFormsOverride?.find((f) => f.key === key);
  return {
    label: fromServer?.label || NATURE_TYPES[key]?.label || key,
    description: fromServer?.description || '',
  };
}

// A spell can have multiple natures at once — this reads the first entry as
// the "primary" one wherever the UI only has room for a single label (card
// headers), and natureLabels() below joins all of them for full-text display.
export function primaryNature(nature) {
  return magicFormInfo(nature?.[0] ?? 'arcana');
}

export function natureLabels(nature) {
  return (nature || []).map((n) => magicFormInfo(n).label).join(', ');
}

export const COMPONENT_UNITS = ['шт.', 'г', 'мг', 'унції', 'краплі', 'щіпки', 'флакони', 'жмені', 'пучки'];
export const CUSTOM_UNIT = '__custom__';

export const RITUAL_TYPES = {
  impossible: { label: 'Неможливий', symbol: '✗' },
  possible:   { label: 'Можливий',   symbol: '◈' },
  required:   { label: 'Необхідний', symbol: '✦' },
};

export { DURATION_UNITS, formatDuration };

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

export const SPELL_COMPLEXITIES = {
  primitive: { label: 'Примітивне' },
  simple:    { label: 'Просте' },
  medium:    { label: 'Середнє' },
  complex:   { label: 'Комплексне' },
  extreme:   { label: 'Надзвичайно складне' },
};

// Поля, що можуть відрізнятися між формами заклинання. Основна форма —
// колонки самого заклинання, додаткові лежать у spell.forms як повні
// знімки саме цих полів + { kind, id, name } (див. constants/forms.js і
// normalizeForms у services/spellbook/src/models/spell.model.js).
export const FORM_FIELDS = [
  'complexity', 'spell_kind', 'energy_cost', 'action_time', 'ritual',
  'duration_value', 'duration_unit', 'range_desc', 'components',
  'mechanical_desc', 'narrative_desc', 'lore_creator', 'lore_creator_npc_id',
];

export { FORM_TIERS, DEFAULT_MAIN_FORM_NAME, hasTierForms, mainFormLabel };

export const pickFormFields = (source) => pickFields(FORM_FIELDS, source);
export const spellFormMode = formModeOf;
export const spellTiers = entryTiers;
export const spellForms = (spell) => entryForms(spell, FORM_FIELDS);
export const spellVariantForms = (spell) => entryVariantForms(spell, FORM_FIELDS);
export const spellForCharacter = (spell, progress) => entryForCharacter(spell, FORM_FIELDS, progress);
export const spellWithForm = (spell, key) => entryWithForm(spell, FORM_FIELDS, key);
