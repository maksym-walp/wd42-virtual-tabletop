const { SKILL_KEYS } = require('../stats');

// Детермінований генератор: кожен виклик повертає наступне значення.
// face(f, sides) — частка, яка в rollDie дає грань f.
const face = (f, sides) => (f - 0.5) / sides;
function seq(...values) {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('rng: забагато кидків');
    return values[i++];
  };
}

function makeSkills(overrides = {}, base = 4) {
  return SKILL_KEYS.map((skill_key) => ({ skill_key, value: overrides[skill_key] ?? base, progress_marks: 2 }));
}

function makeCharacter(overrides = {}) {
  return {
    id: 'c1',
    name: 'Тест',
    archetype: 'rogue',
    conditions: [],
    death_scale: null,
    current_hp: 10,
    current_magic: 0,
    heroic_actions_used: 0,
    // Тілобудова 2 → 11 кубиків, по 5.
    health_dice_values: Array(11).fill(5),
    rest_timer_hours: 0,
    timer_checks_done: 0,
    timer_checks_passed: 0,
    ...overrides,
  };
}

module.exports = { face, seq, makeSkills, makeCharacter };
