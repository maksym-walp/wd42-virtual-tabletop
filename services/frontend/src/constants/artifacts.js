import { EQUIPMENT_TYPES } from './equipment';

// No per-rarity accent color — rarity is conveyed by its label, not a hue
// (colors are reserved for archetype badges, which map to one specific archetype).
export const RARITIES = {
  common:    { label: 'Поширений' },
  uncommon:  { label: 'Незвичний' },
  rare:      { label: 'Рідкісний' },
  legendary: { label: 'Легендарний' },
};

export const ARTIFACT_TYPE = { label: 'Артефакт' };

// Артефакти — четвертий вид спорядження (equipment.artifacts, тег `type` у
// відповіді бекенду), просто з власною карткою/формою. CATALOG_TYPES ловить
// усі чотири під один набір заголовків там, де вони перелічуються разом
// (лист персонажа тощо).
export const CATALOG_TYPES = { ...EQUIPMENT_TYPES, artifact: ARTIFACT_TYPE };
