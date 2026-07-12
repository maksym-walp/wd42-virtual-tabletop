const crypto = require('crypto');

const ROLLS_PER_DIE = { adv: 2, dis: 2, wadv: 3, wdis: 3 };
const KEEP_FN = { adv: Math.max, wadv: Math.max, dis: Math.min, wdis: Math.min };

function rollDie(sides) {
  return crypto.randomInt(1, sides + 1);
}

function evaluateNode(node) {
  if (node.kind === 'modifier') {
    return { type: 'modifier', value: node.value };
  }

  if (node.kind === 'dice') {
    const rolls = Array.from({ length: node.count }, () => rollDie(node.sides));
    return { type: 'dice', sides: node.sides, rolls, subtotal: rolls.reduce((a, b) => a + b, 0) };
  }

  // Wrapped adv/dis/wadv/wdis group: each of the N dice is rolled
  // independently (2 or 3 times), keeping the best/worst per die, then summed.
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
