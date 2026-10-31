import { KEYWORD, withModifier } from '../constants/dice';
import { modifierDie } from '../constants/characterSheet';

// Побудова формули для dice-roller з готового профілю кидка, який прислав
// сервер (character-sheet, rules/modifiers.js). Правил тут немає: режим,
// кубик і бонус уже пораховані з урахуванням станів і модифікаторів
// відкритих вузлів дерева — лишається зібрати рядок.

export const ROLL_MODE_LABELS = {
  normal: 'звичайний',
  adv: 'перевага',
  dis: 'перешкода',
  wadv: 'подвійна перевага',
  wdis: 'подвійна перешкода',
  bal: 'баланс',
  ext: 'екстремум',
};

// Режим обгортає КОЖЕН кубик перевірки окремо, а не суму: при перевазі
// і d20, і кубик навички кидаються двічі (розділ 1.1.4).
const wrap = (mode, group) => (KEYWORD[mode] ? `${KEYWORD[mode]}(${group})` : group);

// Зводить кілька факторів переваги/перешкоди в один режим — дзеркало
// mergeRollModes у character-sheet/src/rules/modifiers.js (правило 1.1.4).
// Потрібне лише тут і лише для ситуативних модифікаторів, які гравець
// вмикає вже у відкритій модалці: сервер про його вибір не знає.
const MODE_WEIGHT = { adv: 1, wadv: 2, dis: -1, wdis: -2 };
const WEIGHT_MODE = { '-2': 'wdis', '-1': 'dis', 0: 'normal', 1: 'adv', 2: 'wadv' };

export function mergeRollModes(modes) {
  let net = 0;
  let bal = 0;
  let ext = 0;
  for (const mode of modes) {
    if (mode === 'bal') bal += 1;
    else if (mode === 'ext') ext += 1;
    else net += MODE_WEIGHT[mode] ?? 0;
  }
  net = Math.max(-2, Math.min(2, net));
  if (net !== 0) return WEIGHT_MODE[String(net)];
  if (bal && !ext) return 'bal';
  if (ext && !bal) return 'ext';
  return 'normal';
}

// → рядок формули або null, якщо кидати нічим.
// withD20 — чи додавати основний d20 (перевірка навички) чи кинути лише
// кубик-модифікатор (ухилення в бою, таймер, Імунітет).
export function buildRollFormula({ die, mode = 'normal', bonus = 0, withD20 = true }) {
  const parts = [];
  if (withD20) parts.push(wrap(mode, '1d20'));
  if (die) parts.push(wrap(mode, `1${die}`));
  if (!parts.length) return null;
  return withModifier(parts.join('+'), bonus) || null;
}

// Профіль із урахуванням увімкнених гравцем ситуативних модифікаторів.
// chosen — масив тих самих обʼєктів, що лежать у profile.situational.
export function applySituational(profile, chosen = []) {
  if (!profile) return profile;
  if (!chosen.length) return { ...profile, extra_sources: [] };

  const modes = [profile.mode ?? 'normal'];
  let bonus = profile.bonus ?? 0;
  let die = profile.die ?? null;
  const extra_sources = [];

  for (const mod of chosen) {
    if (mod.mode === 'bonus') bonus += mod.value;
    else if (mod.mode === 'rank_up' || mod.mode === 'rank_down') die = shiftRank(die, mod);
    else modes.push(mod.mode);
    extra_sources.push(mod.note ? `${mod.source}: ${mod.note}` : mod.source);
  }

  return { ...profile, die, bonus, mode: mergeRollModes(modes), extra_sources };
}

// Сходинка кубиків-модифікаторів — та сама, що в character-sheet/rules/stats.js.
const LADDER = [null, 'd4', 'd6', 'd8', 'd10', 'd12'];

function shiftRank(die, { mode, value }) {
  const step = mode === 'rank_up' ? value : -value;
  const idx = LADDER.indexOf(die);
  if (idx < 0) return step > 0 ? LADDER[1] : null;
  return LADDER[Math.max(0, Math.min(LADDER.length - 1, idx + step))];
}

// Запасний профіль для випадків, коли сервер ще не прислав roll_profiles
// (публічний лист, стара відповідь у кеші): лише кубик за значенням навички.
export function fallbackProfile(value) {
  const die = modifierDie(value);
  return {
    die: die === '—' ? null : die,
    mode: 'normal', bonus: 0, d20: true,
    disabled: false, sources: [], situational: [],
  };
}
