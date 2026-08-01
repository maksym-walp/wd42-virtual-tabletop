// NPC vs Creature — the two entity_type values compendium_entries can hold
// (Single Table Inheritance, see database/migrations/44-compendium-service.sql).
// No per-type accent color — a type is conveyed by its label, not a hue
// (colors are reserved for archetype badges, which map to one specific archetype).
export const ENTITY_TYPES = {
  npc:      { label: 'НІП', newLabel: 'Новий НІП' },
  creature: { label: 'Істота', newLabel: 'Нова істота' },
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
