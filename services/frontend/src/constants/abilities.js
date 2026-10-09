import { pluralizeUk } from '../utils/pluralize';
import {
  pickFields, formModeOf, entryTiers, entryForms, entryVariantForms, entryForCharacter, entryWithForm,
} from './forms';

export const DURATION_UNITS = {
  instant:   'Мить',
  action:    'дія',
  seconds:   'сек.',
  minutes:   'хв.',
  hours:     'год.',
  days:      'дн.',
  permanent: 'Постійно',
};

export function formatDuration(value, unit) {
  if (!unit || unit === 'instant' || unit === 'permanent') return DURATION_UNITS[unit] || '—';
  if (unit === 'action') return `${value ?? '?'} ${pluralizeUk(value ?? 0, ['дія', 'дії', 'дій'])}`;
  return `${value ?? '?'} ${DURATION_UNITS[unit]}`;
}

// Поля, що можуть відрізнятися між формами вміння (модель форм — та сама,
// що й у заклинань, див. constants/forms.js і normalizeForms у
// services/abilities/src/models/ability.model.js). Маневр і архетипи —
// властивості вміння загалом.
export const ABILITY_FORM_FIELDS = [
  'duration_value', 'duration_unit', 'mechanical_desc', 'narrative_desc', 'lore_creator', 'lore_creator_npc_id',
];

export const pickAbilityFormFields = (source) => pickFields(ABILITY_FORM_FIELDS, source);
export const abilityFormMode = formModeOf;
export const abilityTiers = entryTiers;
export const abilityForms = (ability) => entryForms(ability, ABILITY_FORM_FIELDS);
export const abilityVariantForms = (ability) => entryVariantForms(ability, ABILITY_FORM_FIELDS);
export const abilityForCharacter = (ability, progress) => entryForCharacter(ability, ABILITY_FORM_FIELDS, progress);
export const abilityWithForm = (ability, key) => entryWithForm(ability, ABILITY_FORM_FIELDS, key);
