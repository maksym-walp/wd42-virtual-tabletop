// Column names on npcs.npcs / bestiary.creatures — the same 5 attributes the
// skill dice ladder in the backend DTO (services/{npcs,bestiary}/src/dto/
// stat-block.dto.js) is keyed by.
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

// NPC-only gender field — fixed list, matches the backend CHECK constraint
// on npcs.npcs.gender.
export const GENDER_OPTIONS = {
  male: 'Чоловіча',
  female: 'Жіноча',
  other: 'Інша',
  unspecified: 'Не вказано',
};
