const { rollDie } = require('./dice');
const { computeEffects, normalizeConditions, levelOf, setLevel, MAX_DATA_LEVEL } = require('./conditions');

// Таймер діяльності: години від останнього повноцінного відпочинку.
// Перевірка Витривалості — на 12-й годині, далі кожні 6 (12, 18, 24, …);
// кілька порогів, перетятих одним додаванням, перевіряються по черзі.
// Кидається лише кубик-модифікатор Витривалості (без d20); складність
// D = max(1, h) × (F + 1), h — успішні перевірки від початку таймера,
// F — поточна Втома. Успіх: h += 1; провал: +1 рівень Втоми. Без кубика
// (Витривалість 1–3) результат 0 — завжди провал. Хвороба ≥2 подвоює
// додані години; непритомний перевірок не робить (поріг усе одно минає).

const FIRST_CHECK_AT = 12;
const CHECK_STEP = 6;

const nextCheckAt = (checksDone) => FIRST_CHECK_AT + CHECK_STEP * checksDone;
const round2 = (n) => Math.round(n * 100) / 100;

// state: { character, skills }. Повертає нові значення полів персонажа
// (conditions, death_scale, rest_timer_hours, timer_checks_*) і звіт.
function advanceTimer({ character, skills }, hours, rng = Math.random) {
  const archetype = character.archetype;
  const start = computeEffects(character.conditions, skills, archetype, character);
  const added = round2(hours * start.timer_speed);
  const total = round2((Number(character.rest_timer_hours) || 0) + added);

  let conditions = character.conditions || [];
  let deathScale = character.death_scale ?? null;
  let done = Number(character.timer_checks_done) || 0;
  let passed = Number(character.timer_checks_passed) || 0;
  const fatigueBefore = levelOf(conditions, 'fatigue');
  const checks = [];

  while (total >= nextCheckAt(done)) {
    const threshold = nextCheckAt(done);
    done += 1;
    const effects = computeEffects(conditions, skills, archetype, { death_scale: deathScale });
    const F = levelOf(conditions, 'fatigue');
    if (effects.unconscious || effects.dead) {
      checks.push({ threshold, skipped: 'unconscious', fatigue_before: F, fatigue_after: F });
      continue;
    }

    const die = effects.skill_dice.endurance;
    const roll = die ? rollDie(Number(die.slice(1)), rng) : 0;
    const difficulty = Math.max(1, passed) * (F + 1);
    const success = roll >= difficulty;
    if (success) {
      passed += 1;
    } else {
      const next = normalizeConditions(conditions, setLevel(conditions, 'fatigue', Math.min(MAX_DATA_LEVEL, F + 1)), { deathScale, skills });
      conditions = next.conditions;
      deathScale = next.death_scale;
    }
    checks.push({
      threshold, die, roll, difficulty, success,
      fatigue_before: F, fatigue_after: levelOf(conditions, 'fatigue'),
    });
  }

  return {
    conditions,
    death_scale: deathScale,
    rest_timer_hours: total,
    timer_checks_done: done,
    timer_checks_passed: passed,
    hours_added: added,
    timer_speed: start.timer_speed,
    checks,
    fatigue_before: fatigueBefore,
    fatigue_after: levelOf(conditions, 'fatigue'),
    next_check_at: nextCheckAt(done),
  };
}

// Блок timer у відповіді листа.
function timerView(character) {
  const done = Number(character.timer_checks_done) || 0;
  return {
    hours: Number(character.rest_timer_hours) || 0,
    next_check_at: nextCheckAt(done),
    checks_done: done,
    checks_passed: Number(character.timer_checks_passed) || 0,
  };
}

const TIMER_RESET = { rest_timer_hours: 0, timer_checks_done: 0, timer_checks_passed: 0 };

module.exports = { FIRST_CHECK_AT, CHECK_STEP, nextCheckAt, advanceTimer, timerView, TIMER_RESET };
