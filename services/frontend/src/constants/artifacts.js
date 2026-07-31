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

// A character sheet lists entries from both catalogs under one set of type
// headings, so it needs the equipment types plus artifacts in a single map.
export const CATALOG_TYPES = { ...EQUIPMENT_TYPES, artifact: ARTIFACT_TYPE };
