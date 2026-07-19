const crypto = require('crypto');
const { FormulaError } = require('./errors');

const ROLLS_PER_DIE = { adv: 2, dis: 2, wadv: 3, wdis: 3, bal: 3 };
const KEEP_FN = {
  adv: Math.max,
  wadv: Math.max,
  dis: Math.min,
  wdis: Math.min,
  // Median of 3 rolls: the middle value once sorted.
  bal: (...rolls) => [...rolls].sort((a, b) => a - b)[1],
};

const MAX_EXTREMUM_ATTEMPTS = 1000;

function rollDie(sides) {
  return crypto.randomInt(1, sides + 1);
}

// Rolls 2 dice and keeps whichever lands closer to either edge of the die
// (1 or `sides`). On an exact tie in distance, both dice are rerolled.
function rollExtremumPick(sides) {
  const distanceToEdge = (value) => Math.min(value - 1, sides - value);
  for (let attempt = 0; attempt < MAX_EXTREMUM_ATTEMPTS; attempt += 1) {
    const rolls = [rollDie(sides), rollDie(sides)];
    const [d0, d1] = rolls.map(distanceToEdge);
    if (d0 !== d1) return { rolls, kept: d0 < d1 ? rolls[0] : rolls[1] };
  }
  throw new FormulaError('Не вдалося визначити екстремум: забагато нічиїх поспіль');
}

function evaluateNode(node) {
  if (node.kind === 'modifier') {
    return { type: 'modifier', value: node.value };
  }

  if (node.kind === 'dice') {
    const rolls = Array.from({ length: node.count }, () => rollDie(node.sides));
    return { type: 'dice', sides: node.sides, rolls, subtotal: rolls.reduce((a, b) => a + b, 0) };
  }

  if (node.mode === 'ext') {
    const dice = Array.from({ length: node.count }, () => rollExtremumPick(node.sides));
    const subtotal = dice.reduce((sum, d) => sum + d.kept, 0);
    return { type: 'ext', sides: node.sides, dice, subtotal };
  }

  // Wrapped adv/dis/wadv/wdis/bal group: each of the N dice is rolled
  // independently (2 or 3 times), keeping the best/worst/median per die, then summed.
  const rollsPerDie = ROLLS_PER_DIE[node.mode];
  const keepFn = KEEP_FN[node.mode];
  const dice = Array.from({ length: node.count }, () => {
    const rolls = Array.from({ length: rollsPerDie }, () => rollDie(node.sides));
    return { rolls, kept: keepFn(...rolls) };
  });
  const subtotal = dice.reduce((sum, d) => sum + d.kept, 0);
  return { type: node.mode, sides: node.sides, dice, subtotal };
}

function evaluate(terms) {
  const groups = terms.map(({ sign, node }) => {
    const evaluated = evaluateNode(node);
    const magnitude = evaluated.type === 'modifier' ? evaluated.value : evaluated.subtotal;
    return { ...evaluated, sign, subtotal: sign * magnitude };
  });
  const total = groups.reduce((sum, g) => sum + g.subtotal, 0);
  return { groups, total };
}

module.exports = { evaluate };
