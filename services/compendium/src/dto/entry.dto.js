// Compendium entries (NPCs/creatures) have no per-skill level like a player
// character does — their skills are derived purely from the 5 core attributes
// (1..6). This mirrors the frontend's attribute -> die ladder used for agility's
// initiative die (services/frontend/src/constants/characterSheet.js,
// AGILITY_INITIATIVE), the only place in the app with this exact 6-step shape;
// no backend equivalent existed before this DTO.
const ATTRIBUTE_DICE_RANK = { 1: 'd4', 2: 'd6', 3: 'd8', 4: 'd10', 5: 'd12', 6: 'd20' };

// Health-dice count per body attribute value — the exact same body -> dice-
// count table the frontend already uses for player characters
// (PHYSIQUE_HEALTH in services/frontend/src/constants/characterSheet.js),
// reused here instead of inventing a second scale for NPCs/creatures.
const HEALTH_DICE_COUNT_BY_BODY = { 1: 6, 2: 11, 3: 15, 4: 18, 5: 20, 6: 21 };

// The 20 fixed skills and the attribute each is governed by, matching
// character_sheet.skills' skill_key CHECK list and the frontend's
// CHARACTERISTICS grouping (agility/physique/intellect/wisdom/charisma there
// map to compendium's dexterity/body/intelligence/wisdom/charisma columns).
const SKILLS = [
  { key: 'evasion', label: 'Ухилення', attribute: 'dexterity' },
  { key: 'acrobatics', label: 'Акробатика', attribute: 'dexterity' },
  { key: 'stealth', label: 'Непомітність', attribute: 'dexterity' },
  { key: 'sleight_of_hand', label: 'Вправність рук', attribute: 'dexterity' },
  { key: 'strength', label: 'Сила', attribute: 'body' },
  { key: 'immunity', label: 'Імунітет', attribute: 'body' },
  { key: 'magic_sense', label: 'Чуття магії', attribute: 'body' },
  { key: 'endurance', label: 'Витривалість', attribute: 'body' },
  { key: 'history', label: 'Історія', attribute: 'intelligence' },
  { key: 'nature', label: 'Природа', attribute: 'intelligence' },
  { key: 'erudition', label: 'Ерудиція', attribute: 'intelligence' },
  { key: 'mysticism', label: 'Містицизм', attribute: 'intelligence' },
  { key: 'intuition', label: 'Інтуїція', attribute: 'wisdom' },
  { key: 'spellcasting', label: 'Чарування', attribute: 'wisdom' },
  { key: 'cleverness', label: 'Кмітливість', attribute: 'wisdom' },
  { key: 'perception', label: 'Спостережливість', attribute: 'wisdom' },
  { key: 'will', label: 'Воля', attribute: 'charisma' },
  { key: 'deception', label: 'Обман', attribute: 'charisma' },
  { key: 'artistry', label: 'Артистизм', attribute: 'charisma' },
  { key: 'persuasion', label: 'Переконливість', attribute: 'charisma' },
];

// Appends `skills` (dice rank per attribute-governed skill) and `health`
// (dice pool: the species/subspecies' health_die rolled a body-derived
// number of times — health_die itself arrives pre-joined on the row, see
// entry.model.js HEALTH_DIE_JOIN) to an entry row. `health.rolled` is the
// persisted total from `rolled_health` (NPCs only — see
// EntryModel.updateRolledHealth; always null for creatures, which have no
// persistent health and recompute the average from `formula` every time).
function decorateEntry(entry) {
  if (!entry) return entry;
  const skills = SKILLS.map(({ key, label, attribute }) => ({
    key,
    label,
    attribute,
    dice: ATTRIBUTE_DICE_RANK[entry[attribute]] ?? null,
  }));
  const die = entry.health_die || 'd6';
  const count = HEALTH_DICE_COUNT_BY_BODY[entry.body] ?? HEALTH_DICE_COUNT_BY_BODY[1];
  const health = { die, count, formula: `${count}${die}`, rolled: entry.rolled_health ?? null };
  return { ...entry, skills, health };
}

module.exports = { ATTRIBUTE_DICE_RANK, HEALTH_DICE_COUNT_BY_BODY, SKILLS, decorateEntry };
