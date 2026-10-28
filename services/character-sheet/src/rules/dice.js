// Кидки, які робить сам сервер (таймер діяльності, відпочинок). Генератор
// випадкових чисел інжектується (rng() ∈ [0, 1)), щоб тести були
// детермінованими. Формат формули — як у dice-roller: dis(1d8), wdis(1d8).

// Скільки разів кидається кожен кубик у режимі; лишається найгірший кидок.
const MODE_TRIES = { normal: 1, dis: 2, wdis: 3 };

function rollDie(sides, rng = Math.random) {
  return Math.floor(rng() * sides) + 1;
}

// count кубиків по sides граней у режимі mode → { formula, rolls, values, total }:
// rolls — усі кидки кожного кубика, values — те, що лишилось після перешкоди.
function rollDice(count, sides, mode = 'normal', rng = Math.random) {
  const tries = MODE_TRIES[mode] ?? 1;
  const rolls = Array.from({ length: count }, () => Array.from({ length: tries }, () => rollDie(sides, rng)));
  const values = rolls.map((r) => Math.min(...r));
  const base = `${count}d${sides}`;
  return {
    formula: mode === 'normal' ? base : `${mode}(${base})`,
    rolls,
    values,
    total: values.reduce((s, v) => s + v, 0),
  };
}

module.exports = { rollDie, rollDice, MODE_TRIES };
