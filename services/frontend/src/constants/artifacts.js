import { EQUIPMENT_TYPES } from './equipment';

export const RARITIES = {
  common:    { label: 'Поширений', color: '#5b5b5b' },
  uncommon:  { label: 'Незвичний', color: '#2e5240' },
  rare:      { label: 'Рідкісний', color: '#2b4a8a' },
  legendary: { label: 'Легендарний', color: '#8a5a2b' },
};

export const ARTIFACT_TYPE = { label: 'Артефакт', color: '#4a3d66', bg: 'rgba(74,61,102,0.12)' };

// A character sheet lists entries from both catalogs under one set of type
// headings, so it needs the equipment types plus artifacts in a single map.
export const CATALOG_TYPES = { ...EQUIPMENT_TYPES, artifact: ARTIFACT_TYPE };
