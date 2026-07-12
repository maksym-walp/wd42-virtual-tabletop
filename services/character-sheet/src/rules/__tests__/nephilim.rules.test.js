const { calcAllowedBreakthroughs } = require('../nephilim.rules');

describe('calcAllowedBreakthroughs', () => {
  it.each([
    [0, 0],
    [1, 0],
    [4, 0],
    [5, 1],
    [6, 1],
    [10, 1],
    [11, 2],
    [17, 2],
    [18, 3],
    [25, 3],
    [26, 4],
  ])('unlockedCount=%i -> %i', (unlockedCount, expected) => {
    expect(calcAllowedBreakthroughs(unlockedCount)).toBe(expected);
  });

  it('never goes negative for very small inputs', () => {
    expect(calcAllowedBreakthroughs(0)).toBeGreaterThanOrEqual(0);
  });
});
