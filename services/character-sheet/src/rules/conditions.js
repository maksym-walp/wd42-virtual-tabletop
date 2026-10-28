const {
  SKILL_KEYS, PHYSIQUE_SKILLS, LEVEL_MIN_VALUE, skillValues, skillDieSides, lowerRank,
  physiqueLevel, baseMaxMagic,
} = require('./stats');

// Єдине джерело правил станів. Три стани з рівнями 1–5; у даних рівень
// може сягати 9: 6-й робить персонажа непритомним (death_scale = 0), кожен
// наступний, набраний після падіння, зсуває шкалу смерті на −1 (−3 — смерть).
// Ефекти нижчих рівнів діють і на вищих. Кожен рівень стану закреслює
// кубик здоровʼя (stats.maxHp). campaigns і frontend цих таблиць не мають:
// вони отримують обчислений блок effects і тексти condition_levels.

const CONDITION_KEYS = ['fatigue', 'illness', 'trauma'];
const MAX_LEVEL = 5;
const MAX_DATA_LEVEL = 9;
const UNCONSCIOUS_LEVEL = 6;

// Тексти ефектів по рівнях — для UI (GET /config → condition_levels).
const CONDITION_LEVELS = {
  fatigue: [
    { level: 1, text: 'Героїчні дії недоступні; реакції з перешкодою; −1 до ініціативи перед початком бою' },
    { level: 2, text: 'Усі перевірки d20 з перешкодою; −2 до ініціативи' },
    { level: 3, text: 'У бою 2 дії замість 3; реакція недоступна; −3 до ініціативи' },
    { level: 4, text: 'Усі перевірки d20 з подвійною перешкодою; −4 до ініціативи' },
    { level: 5, text: 'Не можна зняти інші стани, поки не знято Втому; у бою 1 дія; −5 до ініціативи' },
  ],
  illness: [
    { level: 1, text: 'Усі кубики зцілення чи відновлення здоровʼя кидаються з перешкодою' },
    { level: 2, text: 'Таймер діяльності йде вдвічі швидше' },
    { level: 3, text: 'Максимум магічної енергії вдвічі менший (угору)' },
    { level: 4, text: 'Усі форми відпочинку потребують удвічі більше часу' },
    { level: 5, text: 'Магічна енергія не відновлюється' },
  ],
  trauma: [
    { level: 1, text: 'Переміщення −1' },
    { level: 2, text: 'Переміщення −2; повʼязані навички використовують кубик-модифікатор на 1 ранг нижчий (d4 → без кубика)' },
    { level: 3, text: 'Переміщення −3; пасивний захист вдвічі менший (угору)' },
    { level: 4, text: 'Переміщення −4; повʼязані навички використовувати неможливо' },
    { level: 5, text: 'Переміщення −5; усі навички Тілобудови падають до мінімуму свого рівня, кола прогресу обнуляються — назавжди, навіть після зняття стану' },
  ],
  beyond: { level: UNCONSCIOUS_LEVEL, text: '6-й рівень будь-якого стану — непритомність; кожен наступний зсуває шкалу смерті на −1' },
};

const CONDITION_LABELS = { fatigue: 'Втома', illness: 'Хвороба', trauma: 'Травма' };

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function levelOf(conditions, type) {
  const entry = (Array.isArray(conditions) ? conditions : []).find((c) => c?.type === type);
  return Number(entry?.level) || 0;
}

function traumaSkillKeys(conditions) {
  const entry = (Array.isArray(conditions) ? conditions : []).find((c) => c?.type === 'trauma');
  return Array.isArray(entry?.skill_keys) ? entry.skill_keys : [];
}

// Повертає копію conditions із рівнем type = level (0 прибирає стан).
function setLevel(conditions, type, level) {
  const list = (Array.isArray(conditions) ? conditions : []).filter((c) => c?.type !== type);
  if (level <= 0) return list;
  const prev = (conditions || []).find((c) => c?.type === type);
  return [...list, { ...prev, type, level }];
}

// Персонаж на шкалі смерті (−2…+2) — непритомний; −3 — помер; +3 — отямився.
function deathState(deathScale) {
  if (deathScale == null) return { unconscious: false, dead: false };
  const v = Number(deathScale);
  return { unconscious: v > -3 && v < 3, dead: v <= -3 };
}

function computeEffects(conditions, skills, archetype, character = {}) {
  const F = levelOf(conditions, 'fatigue');
  const I = levelOf(conditions, 'illness');
  const T = levelOf(conditions, 'trauma');

  const traumaKeys = T >= 2 ? traumaSkillKeys(conditions) : [];
  const disabled = T >= 4 ? traumaKeys : [];
  const penalty = T >= 2 ? Object.fromEntries(traumaKeys.map((k) => [k, 1])) : {};

  const values = skillValues(skills);
  const skillDice = {};
  for (const key of SKILL_KEYS) {
    let sides = skillDieSides(values[key] ?? 1);
    if (disabled.includes(key)) sides = null;
    else if (penalty[key]) sides = lowerRank(sides, penalty[key]);
    skillDice[key] = sides ? `d${sides}` : null;
  }

  const maxMagicBase = baseMaxMagic(archetype, skills);
  let rollMode = 'normal';
  if (F >= 4) rollMode = 'wdis';
  else if (F >= 2) rollMode = 'dis';

  let reactions = 'normal';
  if (F >= 3) reactions = 'none';
  else if (F >= 1) reactions = 'dis';

  let actions = 3;
  if (F >= 5) actions = 1;
  else if (F >= 3) actions = 2;

  return {
    roll_mode: rollMode,
    roll_mode_source: rollMode === 'normal' ? null : { condition: 'fatigue', level: F },
    heroic_disabled: F >= 1,
    reactions,
    actions_per_turn: actions,
    initiative_modifier: F ? -Math.min(F, MAX_LEVEL) : 0,
    timer_speed: I >= 2 ? 2 : 1,
    rest_time_multiplier: I >= 4 ? 2 : 1,
    max_magic_base: maxMagicBase,
    max_magic_effective: I >= 3 ? Math.ceil(maxMagicBase / 2) : maxMagicBase,
    magic_restore_blocked: I >= 5,
    healing_disadvantage: I >= 1,
    movement_penalty: Math.min(T, MAX_LEVEL),
    passive_defense_factor: T >= 3 ? 0.5 : 1,
    skill_rank_penalty: penalty,
    disabled_skill_keys: disabled,
    skill_dice: skillDice,
    block_other_removal: F >= 5,
    ...deathState(character.death_scale),
  };
}

// Нормалізує будь-який запис conditions (PUT листа, таймер, відпочинок):
// фіксовані ключі, рівні 0–9, skill_keys лише в Травми, блок Втоми 5,
// падіння на 6-му рівні, постійний ефект Травми 5. Кидає 400 на
// некоректний ввід. physique_reset — { keys, value }, якщо Травма щойно
// досягла 5: навички Тілобудови опускаються до мінімуму свого рівня.
function normalizeConditions(prev, input, { deathScale = null, skills = [] } = {}) {
  if (!Array.isArray(input)) throw badRequest('conditions має бути масивом');

  const seen = new Set();
  const byType = {};
  for (const entry of input) {
    const type = entry?.type;
    if (!CONDITION_KEYS.includes(type)) throw badRequest(`Невідомий стан: ${type ?? '—'}`);
    if (seen.has(type)) throw badRequest(`Стан «${CONDITION_LABELS[type]}» вказано двічі`);
    seen.add(type);
    const level = entry.level ?? 0;
    if (!Number.isInteger(level) || level < 0 || level > MAX_DATA_LEVEL) {
      throw badRequest(`Рівень стану «${CONDITION_LABELS[type]}» — ціле від 0 до ${MAX_DATA_LEVEL}`);
    }
    byType[type] = { ...entry, level };
  }

  const conditions = [];
  for (const type of CONDITION_KEYS) {
    const entry = byType[type];
    if (!entry || entry.level === 0) continue;
    if (type === 'trauma') {
      const raw = Array.isArray(entry.skill_keys) ? entry.skill_keys : traumaSkillKeys(prev);
      const keys = [...new Set(raw.filter((k) => SKILL_KEYS.includes(k)))];
      conditions.push({ type, level: entry.level, skill_keys: keys });
    } else {
      conditions.push({ type, level: entry.level });
    }
  }

  const before = Object.fromEntries(CONDITION_KEYS.map((t) => [t, levelOf(prev, t)]));
  const after = Object.fromEntries(CONDITION_KEYS.map((t) => [t, levelOf(conditions, t)]));

  if (after.fatigue >= MAX_LEVEL && (after.illness < before.illness || after.trauma < before.trauma)) {
    throw badRequest('Поки Втома на 5-му рівні, інші стани зняти не можна — спершу зніміть Втому');
  }

  let ds = deathScale == null ? null : Number(deathScale);
  for (const type of CONDITION_KEYS) {
    const p = before[type];
    const n = after[type];
    if (n >= UNCONSCIOUS_LEVEL && p < UNCONSCIOUS_LEVEL && (ds == null || ds > 0)) ds = 0;
    const extra = n - Math.max(p, UNCONSCIOUS_LEVEL);
    if (extra > 0) ds = Math.max(-3, (ds ?? 0) - extra);
  }

  let physiqueReset = null;
  if (after.trauma >= MAX_LEVEL && before.trauma < MAX_LEVEL) {
    physiqueReset = { keys: PHYSIQUE_SKILLS, value: LEVEL_MIN_VALUE[physiqueLevel(skills)] };
  }

  return { conditions, death_scale: ds, physique_reset: physiqueReset };
}

module.exports = {
  CONDITION_KEYS, CONDITION_LEVELS, CONDITION_LABELS, MAX_LEVEL, MAX_DATA_LEVEL, UNCONSCIOUS_LEVEL,
  levelOf, setLevel, traumaSkillKeys, deathState, computeEffects, normalizeConditions,
};
