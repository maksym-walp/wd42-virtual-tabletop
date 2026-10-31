// Структурований механічний бік ефекту вузла (міграція 112): що саме
// система застосовує сама, коли вузол відкрито. `nodes.effect` лишається
// вільним текстом для опису — тут лише те, що можна порахувати.
//
// Валідація навмисно «тиха», як і в spell-access.js: невідома ціль чи режим
// просто відкидаються, а не валять увесь запит. Форму вузла заповнює ГМ
// через пікер, тож невідоме значення тут означає зіпсований імпорт, а не
// помилку користувача, яку варто показувати.

const crypto = require('crypto');

// Ті самі 20 ключів, що й у character_sheet.skills (порядок — як у книзі).
const SKILL_TARGETS = [
  'evasion', 'acrobatics', 'stealth', 'sleight_of_hand',
  'strength', 'immunity', 'magic_sense', 'endurance',
  'history', 'nature', 'erudition', 'mysticism',
  'intuition', 'spellcasting', 'cleverness', 'perception',
  'will', 'deception', 'artistry', 'persuasion',
];

// Кидки, що навичками не є, але теж залежать від дерева:
//   initiative      — кидок ініціативи перед боєм (4.1)
//   attack          — влучання (4.4.1)
//   damage_dice     — кількість кубиків шкоди, Майстерність M (4.4.3)
//   death_save      — рятівний кидок від смерті, d12 (5.3.2)
//   endurance_timer — перевірка Витривалості таймера діяльності (5.2.1)
//   immunity_check  — перевірка Імунітету проти зараження (5.2.2)
const COMBAT_TARGETS = [
  'initiative', 'attack', 'damage_dice', 'death_save', 'endurance_timer', 'immunity_check',
];

const TARGETS = [...SKILL_TARGETS, ...COMBAT_TARGETS];

// Шість режимів кидка з розділу 1.1 плюс два числові способи вплинути на
// кидок, не чіпаючи його режим.
const ROLL_MODES = ['adv', 'dis', 'wadv', 'wdis', 'bal', 'ext'];
const VALUE_MODES = ['bonus', 'rank_up', 'rank_down'];
const MODES = [...ROLL_MODES, ...VALUE_MODES];

// Кількість кубиків шкоди не має режиму — її можна лише додати.
const DAMAGE_DICE_MODES = ['bonus'];

const MAX_VALUE = 20;
const MAX_NOTE = 200;

function sanitizeOne(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const target = TARGETS.includes(raw.target) ? raw.target : null;
  if (!target) return null;

  const allowed = target === 'damage_dice' ? DAMAGE_DICE_MODES : MODES;
  const mode = allowed.includes(raw.mode) ? raw.mode : null;
  if (!mode) return null;

  // Режими кидка значення не несуть; числові — несуть, і без нього марні.
  let value = 0;
  if (VALUE_MODES.includes(mode)) {
    value = Math.trunc(Number(raw.value));
    if (!Number.isFinite(value) || value === 0) return null;
    value = Math.max(-MAX_VALUE, Math.min(MAX_VALUE, value));
    // Ранг і кількість кубиків — лише вгору чи вниз за назвою режиму,
    // тож знак тут зайвий і лише плутав би.
    if (mode !== 'bonus') value = Math.abs(value);
  }

  const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, MAX_NOTE) : '';

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : crypto.randomUUID(),
    target,
    mode,
    value,
    situational: raw.situational === true,
    note,
  };
}

function sanitizeModifiers(list) {
  return (Array.isArray(list) ? list : []).map(sanitizeOne).filter(Boolean);
}

module.exports = {
  SKILL_TARGETS, COMBAT_TARGETS, TARGETS, ROLL_MODES, VALUE_MODES, MODES,
  sanitizeModifiers,
};
