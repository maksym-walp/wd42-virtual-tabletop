// NPC vs Creature — the two entity_type values compendium_entries can hold
// (Single Table Inheritance, see database/migrations/44-compendium-service.sql).
export const ENTITY_TYPES = {
  npc:      { label: 'НІП',    color: '#3d6b8a', bg: 'rgba(61,107,138,0.12)' },
  creature: { label: 'Істота', color: '#7a3320', bg: 'rgba(122,51,32,0.12)' },
};

export const ENTITY_TYPES_DARK = {
  npc:      { label: 'НІП',    color: '#7fb6db', bg: 'rgba(127,182,219,0.12)' },
  creature: { label: 'Істота', color: '#e0836a', bg: 'rgba(224,131,106,0.12)' },
};

// Column names on compendium_entries — the same 5 attributes the skill dice
// ladder in the backend DTO (services/compendium/src/dto/entry.dto.js) is
// keyed by.
export const ATTRIBUTE_LABELS = {
  dexterity: 'Спритність',
  body: 'Тілобудова',
  intelligence: 'Інтелект',
  wisdom: 'Мудрість',
  charisma: 'Харизма',
};

// Health die rank a species/subspecies is authored with — matches
// services/compendium/src/constants/health-dice.js HEALTH_DICE.
export const HEALTH_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
