export const ARCHETYPES = {
  fighter: {
    label: 'Боєць', healthDie: 'd10', magicMult: 2, meditationDie: 'd4',
    description: 'Архетип прямого бою — атаки, ухилення та бойові маневри. Магія доступна, але не така потужна, як у чаклунів чи пройдисвітів.',
  },
  spellcaster: {
    label: 'Чаклун', healthDie: 'd6', magicMult: 6, meditationDie: 'd8',
    description: 'Архетип, найтісніше пов\'язаний із магією — найбільше магічної енергії та найрізноманітніший арсенал чаротворчих здібностей.',
  },
  rogue: {
    label: 'Пройдисвіт', healthDie: 'd8', magicMult: 4, meditationDie: 'd6',
    description: 'Універсал з доступом і до бойових, і до магічних гілок розвитку. Не домінує ніде, зате винагороджується за різноманітність дій.',
  },
};

// Same {color, bg} badge pattern as MAGIC_TYPES (constants/spellbook.js) —
// text colored as the hue, translucent tint as background. Kept centralized
// here (not duplicated per-page) since both CharacterList and CharacterNew
// badge archetypes.
export const ARCHETYPE_COLORS = {
  fighter:     { color: '#24223f', bg: 'rgba(36,34,63,0.12)' },
  spellcaster: { color: '#4d2741', bg: 'rgba(77,39,65,0.12)' },
  rogue:       { color: '#223f27', bg: 'rgba(34,63,39,0.12)' },
};

export const RACES = {
  human: {
    label: 'Людина', ability: 'Перерозподіл',
    description: 'Швидкоплинна й адаптивна натура — при кожному новому вузлі дерева розвитку може перерозподілити один кінцевий вузол.',
  },
  gnome: {
    label: 'Гном', ability: 'Унікальні мости',
    description: 'Постійне прагнення до розвитку — доступ до унікальних мостових зв\'язків між гілками різних архетипів.',
  },
  dwarf: {
    label: 'Дворф', ability: 'Унікальні мости',
    description: 'Постійне прагнення до розвитку — доступ до унікальних мостових зв\'язків між гілками різних архетипів.',
  },
  elf: {
    label: 'Ельф', ability: 'Додаткові вузли',
    description: 'Фейське походження — на дереві розвитку має додаткові унікальні вузли понад стандартні.',
  },
  sangvi: {
    label: 'Санґви', ability: 'Спадок пращурів', hasAncestry: true,
    description: 'Нащадок кількох народів — при створенні обирає особливість одного з народів-пращурів.',
  },
  nephilim: {
    label: 'Нефілім', ability: 'Прорив',
    description: 'Надприродне походження — може здійснити прорив, перескочивши через вузол дерева розвитку (обмежена кількість разів).',
  },
  other: {
    label: 'Інший народ', ability: 'Замінені вузли',
    description: 'Принципово інший шлях розвитку — частина стандартних вузлів дерева замінена унікальними.',
  },
};

export const RACE_ANCESTRY_OPTIONS = ['human', 'gnome', 'dwarf', 'elf', 'nephilim', 'other'];

// Characteristic groups: each contains 4 skills
export const CHARACTERISTICS = [
  {
    key: 'agility',
    label: 'Спритність',
    effect: (level) => AGILITY_INITIATIVE[level],
    effectLabel: 'Кубик ініціативи',
    skills: [
      { key: 'evasion',        label: 'Ухилення' },
      { key: 'acrobatics',     label: 'Акробатика' },
      { key: 'stealth',        label: 'Непомітність' },
      { key: 'sleight_of_hand', label: 'Вправність рук' },
    ],
  },
  {
    key: 'physique',
    label: 'Тілобудова',
    effect: (level) => PHYSIQUE_HEALTH[level],
    effectLabel: 'Кількість кісток здоров\'я',
    skills: [
      { key: 'strength',    label: 'Сила' },
      { key: 'immunity',    label: 'Імунітет' },
      { key: 'magic_sense', label: 'Чуття магії' },
      { key: 'endurance',   label: 'Витривалість' },
    ],
  },
  {
    key: 'intellect',
    label: 'Інтелект',
    effect: (level) => level,
    effectLabel: 'Артефактів одночасно',
    skills: [
      { key: 'history',    label: 'Історія' },
      { key: 'nature',     label: 'Природа' },
      { key: 'erudition',  label: 'Ерудиція' },
      { key: 'mysticism',  label: 'Містицизм' },
    ],
  },
  {
    key: 'wisdom',
    label: 'Мудрість',
    effect: (level) => WISDOM_HEROIC[level],
    effectLabel: 'Героїчних дій',
    skills: [
      { key: 'intuition',    label: 'Інтуїція' },
      { key: 'spellcasting', label: 'Чарування' },
      { key: 'cleverness',   label: 'Кмітливість' },
      { key: 'perception',   label: 'Спостережливість' },
    ],
  },
  {
    key: 'charisma',
    label: 'Харизма',
    effect: (level) => CHARISMA_INSPIRATION[level],
    effectLabel: 'Кубик натхнення',
    skills: [
      { key: 'will',        label: 'Воля' },
      { key: 'deception',   label: 'Обман' },
      { key: 'artistry',    label: 'Артистизм' },
      { key: 'persuasion',  label: 'Переконливість' },
    ],
  },
];

// minimum skill value required to keep characteristic at a given level
export const LEVEL_MIN_VALUE = { 1: 1, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12 };

// value → level (1..6)
export function valueToLevel(value) {
  if (value >= 12)  return 6;
  if (value >= 10)  return 5;
  if (value >= 8)   return 4;
  if (value >= 6)   return 3;
  if (value >= 4)   return 2;
  return 1;
}

// value → modifier die label
export function modifierDie(value) {
  if (value >= 12)  return 'd12';
  if (value >= 10)  return 'd10';
  if (value >= 8)   return 'd8';
  if (value >= 6)   return 'd6';
  if (value >= 4)   return 'd4';
  return '—';
}

// characteristic level (min of 4 skill values) → level number
export function skillsToCharLevel(skillValues) {
  if (!skillValues.length) return 1;
  const min = Math.min(...skillValues);
  return valueToLevel(min);
}

// Agility level → initiative die
const AGILITY_INITIATIVE = { 1: 'd4', 2: 'd6', 3: 'd8', 4: 'd10', 5: 'd12', 6: 'd20' };

// Physique level → health dice count
export const PHYSIQUE_HEALTH = { 1: 6, 2: 11, 3: 15, 4: 18, 5: 20, 6: 21 };

// Wisdom level → heroic actions count
const WISDOM_HEROIC = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };

// Charisma level → inspiration die
const CHARISMA_INSPIRATION = { 1: '—', 2: 'd4', 3: 'd6', 4: 'd8', 5: 'd10', 6: 'd12' };

// Archetype healing die (one step below health die)
export const HEALING_DIE = { fighter: 'd8', spellcaster: 'd4', rogue: 'd6' };

export const CONDITIONS = [
  { key: 'exhaustion', label: 'Втома',           maxLevel: 6 },
  { key: 'injury',     label: 'Поранення',        maxLevel: null },
  { key: 'illness',    label: 'Хвороба',           maxLevel: null },
  { key: 'poison',     label: 'Отруєння',          maxLevel: null },
  { key: 'trauma',     label: 'Серйозна травма',   maxLevel: null },
];

export const DAMAGE_DICE = ['d4', 'd6', 'd8', 'd10', 'd12'];

// Coin denominations by mint, from the character-sheet template (ttrpg-system/*.png) —
// each mint has a high/low pair at a fixed 1:100 ratio within itself, except
// "Інші" (infernal gold / gemstones aren't a fixed-rate coinage).
export const CURRENCIES = [
  {
    region: 'Великий Арбор',
    high: { key: 'alios', name: 'Альґос', metal: 'золото' },
    low: { key: 'delios', name: 'Дельґос', metal: 'срібло' },
    convertible: true,
  },
  {
    region: 'Трикоронний монетний договір',
    high: { key: 'asim', name: 'Асім', metal: 'золото' },
    low: { key: 'bronvit', name: 'Бронвіт', metal: 'бронза' },
    convertible: true,
  },
  {
    region: 'Карифське царство',
    high: { key: 'tezar', name: 'Тезар', metal: 'бронза' },
    low: { key: 'kuprum', name: 'Купрум', metal: 'бронза' },
    convertible: true,
  },
  {
    region: 'Даварія',
    high: { key: 'velykyi_tong', name: 'Великий Тонг', metal: 'бронза' },
    low: { key: 'malyi_tong', name: 'Малий Тонг', metal: 'бронза' },
    convertible: true,
  },
  {
    region: 'Інші',
    high: { key: 'infernalne_zoloto', name: 'Інфернальне золото', metal: null },
    low: { key: 'samotsvity', name: 'Самоцвіти', metal: 'у золоті' },
    convertible: false,
  },
];

// Roll starting/additional health dice: dieSize from ARCHETYPES[x].healthDie (e.g. 10 for 'd10'),
// maxDiceCount from PHYSIQUE_HEALTH[physiqueLevel]. Returns the sorted dice pool only — callers
// derive current HP themselves since that depends on context (e.g. crossed-out condition dice).
// Shared by VitalsTab (reroll) and the character-creation wizard (initial roll).
export function rollHealthDice(dieSize, maxDiceCount, existing = []) {
  const needed = maxDiceCount - existing.length;
  if (needed <= 0) return existing;
  const newRolls = Array.from({ length: needed }, () => Math.ceil(Math.random() * dieSize));
  return [...existing, ...newRolls].sort((a, b) => a - b);
}
