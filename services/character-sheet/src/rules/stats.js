// Базові характеристики листа, потрібні правилам станів і відпочинку
// (максимум здоровʼя, енергії, героїчних дій). Це дзеркало констант
// frontend (services/frontend/src/constants/characterSheet.js) — лише базові
// таблиці; таблиці станів живуть тільки в conditions.js.

const SKILL_KEYS = [
  'evasion', 'acrobatics', 'stealth', 'sleight_of_hand',
  'strength', 'immunity', 'magic_sense', 'endurance',
  'history', 'nature', 'erudition', 'mysticism',
  'intuition', 'spellcasting', 'cleverness', 'perception',
  'will', 'deception', 'artistry', 'persuasion',
];
const PHYSIQUE_SKILLS = ['strength', 'immunity', 'magic_sense', 'endurance'];
const WISDOM_SKILLS = ['intuition', 'spellcasting', 'cleverness', 'perception'];

// Рівень Тілобудови → кількість кубиків здоровʼя.
const PHYSIQUE_HEALTH = { 1: 6, 2: 11, 3: 15, 4: 18, 5: 20, 6: 21 };
// Мінімальне значення навички, що тримає характеристику на рівні.
const LEVEL_MIN_VALUE = { 1: 1, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12 };
// Рівень Мудрості → кількість героїчних дій.
const HEROIC_COUNT = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };

// multiplier — K (енергія, кубики d4 повноцінного відпочинку);
// healingDie — на ранг нижче за кубик здоровʼя.
const ARCHETYPES = {
  fighter:     { multiplier: 2, healthDie: 10, healingDie: 8 },
  rogue:       { multiplier: 4, healthDie: 8,  healingDie: 6 },
  spellcaster: { multiplier: 6, healthDie: 6,  healingDie: 4 },
};

const DIE_LADDER = [null, 4, 6, 8, 10, 12];

function valueToLevel(value) {
  if (value >= 12) return 6;
  if (value >= 10) return 5;
  if (value >= 8) return 4;
  if (value >= 6) return 3;
  if (value >= 4) return 2;
  return 1;
}

// Кубик-модифікатор навички: 1–3 — нема (null), 4–5 d4, … 12 d12.
function skillDieSides(value) {
  if (value >= 12) return 12;
  if (value >= 10) return 10;
  if (value >= 8) return 8;
  if (value >= 6) return 6;
  if (value >= 4) return 4;
  return null;
}

// Кубик на ranks рангів нижче (d4 → без кубика).
function lowerRank(sides, ranks = 1) {
  const idx = DIE_LADDER.indexOf(sides);
  if (idx <= 0) return null;
  return DIE_LADDER[Math.max(0, idx - ranks)];
}

function skillValues(skills) {
  const map = {};
  for (const s of skills || []) {
    if (s && typeof s === 'object' && s.skill_key) map[s.skill_key] = Number(s.value) || 0;
  }
  return map;
}

function characteristicLevel(skills, keys) {
  const values = skillValues(skills);
  return valueToLevel(Math.min(...keys.map((k) => values[k] ?? 1)));
}

const physiqueLevel = (skills) => characteristicLevel(skills, PHYSIQUE_SKILLS);

function conditionLevelSum(conditions) {
  return (Array.isArray(conditions) ? conditions : []).reduce((s, c) => s + (Number(c?.level) || 0), 0);
}

// Поточний максимум здоровʼя: сума незакреслених кубиків. Кожен рівень
// стану закреслює найбільший доступний кубик (кубики зберігаються
// відсортованими за зростанням, тож закреслюються останні).
function maxHp(character, skills, conditions = character.conditions) {
  const maxDice = PHYSIQUE_HEALTH[physiqueLevel(skills)] ?? 6;
  const active = (character.health_dice_values || []).slice(0, Math.max(0, maxDice - conditionLevelSum(conditions)));
  return active.reduce((s, v) => s + (Number(v) || 0), 0);
}

function baseMaxMagic(archetype, skills) {
  const magicSense = skillValues(skills).magic_sense ?? 1;
  return magicSense * (ARCHETYPES[archetype]?.multiplier ?? 0);
}

const heroicTotal = (skills) => HEROIC_COUNT[characteristicLevel(skills, WISDOM_SKILLS)] ?? 0;

module.exports = {
  SKILL_KEYS, PHYSIQUE_SKILLS, WISDOM_SKILLS,
  PHYSIQUE_HEALTH, LEVEL_MIN_VALUE, HEROIC_COUNT, ARCHETYPES,
  valueToLevel, skillDieSides, lowerRank, skillValues, characteristicLevel, physiqueLevel,
  conditionLevelSum, maxHp, baseMaxMagic, heroicTotal,
};
