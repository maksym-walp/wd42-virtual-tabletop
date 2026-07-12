// Inverse of the triangular-number formula 1+2+...+n = n(n+1)/2 solved for n,
// gating how many breakthroughs a character may use based on unlocked nodes.
function calcAllowedBreakthroughs(unlockedCount) {
  return Math.max(0, Math.floor((-9 + Math.sqrt(81 + 8 * unlockedCount)) / 2));
}

module.exports = { calcAllowedBreakthroughs };
