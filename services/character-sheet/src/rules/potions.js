const { rollDie, rollDice } = require('./dice');
const { maxHp } = require('./stats');
const { computeEffects, normalizeConditions, levelOf, setLevel, MAX_DATA_LEVEL } = require('./conditions');

// Зілля зцілення і звикання до них. Кожна порція — кидок кубика зцілення
// рівня зілля (heal_die з equipment.potions; при Хворобі ≥1 — з перешкодою).
//
// Звикання: з кожною порцією, поки персонаж не звик, кидається кубик на ранг
// вищий, ніж попереднього разу (d4 → d6 → d8 → d10 → d12 → d20 → d100);
// 4 і більше — персонаж звик. Після звикання ефект наступних порцій удвічі
// менший (сума їхніх кидків, угору), а кожен ковток таких «зайвих» порцій
// вимагає перевірки Імунітету: лише кубик-модифікатор Імунітету (без d20)
// проти складності = усім порціям, випитим після звикання. Провал — +1 рівень
// Хвороби за кожні 2 зайві порції цього ковтка (угору), успіх — половина цих
// рівнів (униз). Зцілення від зайвих порцій усе одно відбувається.
//
// Перепочинок знижує ранг кубика звикання на 1, повноцінний відпочинок і
// довготривале відновлення скидають звикання повністю (rest.js).

const HABIT_LADDER = [4, 6, 8, 10, 12, 20, 100];
const HABIT_THRESHOLD = 4;
const MAX_PORTIONS_PER_DRINK = 50;

const habitDie = (rank) => HABIT_LADDER[Math.min(Math.max(0, rank), HABIT_LADDER.length - 1)];

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

// Запас зілля в листі: повні ємності + залишок у відкритій.
function availablePortions({ containers, open_portions: open }, size) {
  return (Number(containers) || 0) * size + (Number(open) || 0);
}

// Списує k порцій: спершу з відкритої ємності, потім відкриває нові.
function consumeStock(stock, size, k) {
  if (k > availablePortions(stock, size)) throw badRequest('Стільки порцій цього зілля нема');
  let containers = Number(stock.containers) || 0;
  let open = Number(stock.open_portions) || 0;
  let need = k;
  while (need > 0) {
    if (open === 0) { containers -= 1; open = size; }
    const take = Math.min(open, need);
    open -= take;
    need -= take;
  }
  return { containers, open_portions: open };
}

// state: { character, skills }; potion: { healDie, portions }. Повертає
// { result, fields } — fields лягають у character_sheet.characters.
function drinkPotion({ character, skills }, { healDie, portions }, rng = Math.random) {
  if (!Number.isInteger(portions) || portions < 1 || portions > MAX_PORTIONS_PER_DRINK) {
    throw badRequest(`portions — ціле від 1 до ${MAX_PORTIONS_PER_DRINK}`);
  }
  const effects = computeEffects(character.conditions, skills, character.archetype, character);
  const mode = effects.healing_disadvantage ? 'dis' : 'normal';

  let rank = Number(character.potion_habit_rank) || 0;
  let habituated = !!character.potion_habituated;
  let excess = Number(character.potion_excess_portions) || 0;
  const fullRolls = [];
  const halvedRolls = [];
  const habitRolls = [];

  for (let i = 1; i <= portions; i += 1) {
    const heal = rollDice(1, healDie, mode, rng);
    if (habituated) {
      halvedRolls.push({ portion: i, ...heal });
      continue;
    }
    fullRolls.push({ portion: i, ...heal });
    const sides = habitDie(rank);
    const roll = rollDie(sides, rng);
    rank += 1;
    const hit = roll >= HABIT_THRESHOLD;
    habitRolls.push({ portion: i, die: `d${sides}`, roll, habituated: hit });
    if (hit) habituated = true;
  }

  const fullTotal = fullRolls.reduce((s, r) => s + r.total, 0);
  const halvedRaw = halvedRolls.reduce((s, r) => s + r.total, 0);
  const halvedTotal = Math.ceil(halvedRaw / 2);
  const hpBefore = Number(character.current_hp) || 0;
  const hpMax = maxHp(character, skills);
  const hp = Math.max(hpBefore, Math.min(hpMax, hpBefore + fullTotal + halvedTotal));

  let conditions = character.conditions || [];
  let deathScale = character.death_scale ?? null;
  let immunity = null;
  const notes = [];
  if (effects.healing_disadvantage) notes.push('Хвороба: кубики зцілення з перешкодою');

  if (halvedRolls.length) {
    excess += halvedRolls.length;
    const die = effects.skill_dice.immunity;
    const roll = die ? rollDie(Number(die.slice(1)), rng) : 0;
    const success = roll >= excess;
    const levels = Math.ceil(halvedRolls.length / 2);
    const added = success ? Math.floor(levels / 2) : levels;
    const before = levelOf(conditions, 'illness');
    if (added > 0) {
      const next = normalizeConditions(conditions, setLevel(conditions, 'illness', Math.min(MAX_DATA_LEVEL, before + added)), { deathScale, skills });
      conditions = next.conditions;
      deathScale = next.death_scale;
    }
    immunity = {
      die, roll, difficulty: excess, success,
      illness_added: added, illness_before: before, illness_after: levelOf(conditions, 'illness'),
    };
    notes.push('Звикання: ефект зайвих порцій удвічі менший');
  }

  return {
    result: {
      portions,
      heal_die: `d${healDie}`,
      heal_rolls: [...fullRolls, ...halvedRolls].sort((a, b) => a.portion - b.portion)
        .map((r) => ({ ...r, halved: halvedRolls.includes(r) })),
      heal: { full: fullTotal, halved_raw: halvedRaw, halved: halvedTotal, total: fullTotal + halvedTotal },
      hp: { before: hpBefore, after: hp, max: hpMax },
      habituation: {
        rolls: habitRolls,
        habituated,
        became_habituated: habituated && !character.potion_habituated,
        next_die: habituated ? null : `d${habitDie(rank)}`,
        excess_portions: excess,
      },
      immunity,
      notes,
    },
    fields: {
      current_hp: hp,
      conditions,
      death_scale: deathScale,
      potion_habit_rank: rank,
      potion_habituated: habituated,
      potion_excess_portions: excess,
    },
  };
}

// Блок potions у відповіді листа.
function potionView(character) {
  const rank = Number(character.potion_habit_rank) || 0;
  const habituated = !!character.potion_habituated;
  return {
    habit_rank: rank,
    habituated,
    next_die: habituated ? null : `d${habitDie(rank)}`,
    excess_portions: Number(character.potion_excess_portions) || 0,
  };
}

// Як відпочинок змінює звикання: short — ранг −1, full/long — скидання.
function restPotionFields(kind, character) {
  const rank = Number(character.potion_habit_rank) || 0;
  if (kind === 'short') return { potion_habit_rank: Math.max(0, rank - 1) };
  return { potion_habit_rank: 0, potion_habituated: false, potion_excess_portions: 0 };
}

module.exports = {
  HABIT_LADDER, HABIT_THRESHOLD, MAX_PORTIONS_PER_DRINK,
  habitDie, availablePortions, consumeStock, drinkPotion, potionView, restPotionFields,
};
