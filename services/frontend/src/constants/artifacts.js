import { EQUIPMENT_TYPES, EQUIPMENT_TYPES_DARK } from './equipment';

export const RARITIES = {
  common:    { label: 'Поширений', color: '#5b5b5b' },
  uncommon:  { label: 'Незвичний', color: '#2e5240' },
  rare:      { label: 'Рідкісний', color: '#2b4a8a' },
  legendary: { label: 'Легендарний', color: '#8a5a2b' },
};

// Lightened hues of RARITIES for legibility against the dark-theme surface —
// same keys/labels, picked via useTheme() at the call site.
export const RARITIES_DARK = {
  common:    { label: 'Поширений', color: '#9a9a9a' },
  uncommon:  { label: 'Незвичний', color: '#7fcf9e' },
  rare:      { label: 'Рідкісний', color: '#7fa8e0' },
  legendary: { label: 'Легендарний', color: '#d9a066' },
};

export const ARTIFACT_TYPE = { label: 'Артефакт', color: '#4a3d66', bg: 'rgba(74,61,102,0.12)' };
export const ARTIFACT_TYPE_DARK = { label: 'Артефакт', color: '#a78bda', bg: 'rgba(167,139,218,0.12)' };

// A character sheet lists entries from both catalogs under one set of type
// headings, so it needs the equipment types plus artifacts in a single map.
export const CATALOG_TYPES = { ...EQUIPMENT_TYPES, artifact: ARTIFACT_TYPE };
export const CATALOG_TYPES_DARK = { ...EQUIPMENT_TYPES_DARK, artifact: ARTIFACT_TYPE_DARK };
