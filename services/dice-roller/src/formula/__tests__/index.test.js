const { rollFormula, FormulaError } = require('../index');

// This suite exercises the orchestration in index.js (empty-formula guard,
// MAX_TERMS, MAX_TOTAL_DICE + mode multipliers) using real formula strings —
// tokenizer/parser/evaluator are already covered in their own test files.

describe('rollFormula - basic orchestration', () => {
  it('rolls a simple formula and returns formula/total/groups', () => {
    const result = rollFormula('2d20+5');
    expect(result.formula).toBe('2d20+5');
    expect(typeof result.total).toBe('number');
    expect(Array.isArray(result.groups)).toBe(true);
    expect(result.groups).toHaveLength(2);
  });

  it('throws a FormulaError for an empty formula string', () => {
    expect(() => rollFormula('')).toThrow(FormulaError);
    expect(() => rollFormula('')).toThrow('Формула не може бути порожньою');
  });

  it('throws a FormulaError for a whitespace-only formula string', () => {
    expect(() => rollFormula('   ')).toThrow(FormulaError);
  });
});

describe('rollFormula - MAX_TERMS (20)', () => {
  it('accepts a formula with exactly 20 terms', () => {
    const f = Array(20).fill('1').join('+');
    expect(() => rollFormula(f)).not.toThrow();
  });

  it('rejects a formula with more than 20 terms', () => {
    const f = Array(21).fill('1').join('+');
    expect(() => rollFormula(f)).toThrow(FormulaError);
    expect(() => rollFormula(f)).toThrow(/Забагато доданків/);
  });
});

describe('rollFormula - MAX_TOTAL_DICE (500) with mode multipliers', () => {
  it('accepts plain dice terms totalling exactly 500 (1x multiplier)', () => {
    // 4 * 100d6 + 1 * 99d6 = 499, well under the cap
    const f = ['100d6', '100d6', '100d6', '100d6', '99d6'].join('+');
    expect(() => rollFormula(f)).not.toThrow();
  });

  it('rejects plain dice terms totalling over 500 (1x multiplier)', () => {
    // 5 * 100d6 + 1d6 = 501
    const f = ['100d6', '100d6', '100d6', '100d6', '100d6', '1d6'].join('+');
    expect(() => rollFormula(f)).toThrow(FormulaError);
    expect(() => rollFormula(f)).toThrow(/Забагато кубиків/);
  });

  it('applies the 2x multiplier for advantage groups', () => {
    // 3 * adv(100d6): raw count = 300 (would pass at 1x), but 300 * 2 = 600 > 500
    const f = ['adv(100d6)', 'adv(100d6)', 'adv(100d6)'].join('+');
    expect(() => rollFormula(f)).toThrow(FormulaError);
    expect(() => rollFormula(f)).toThrow(/Забагато кубиків/);
  });

  it('applies the 2x multiplier for disadvantage groups', () => {
    const f = ['dis(100d6)', 'dis(100d6)', 'dis(100d6)'].join('+');
    expect(() => rollFormula(f)).toThrow(FormulaError);
  });

  it('a single advantage group of 100 dice (200 effective) stays under the cap', () => {
    const result = rollFormula('adv(100d6)');
    expect(result.total).toEqual(expect.any(Number));
  });

  it('applies the 3x multiplier for weighted-advantage groups', () => {
    // 2 * wadv(100d6): raw count = 200 (would pass at 1x or 2x), but 200 * 3 = 600 > 500
    const f = ['wadv(100d6)', 'wadv(100d6)'].join('+');
    expect(() => rollFormula(f)).toThrow(FormulaError);
    expect(() => rollFormula(f)).toThrow(/Забагато кубиків/);
  });

  it('applies the 3x multiplier for weighted-disadvantage groups', () => {
    const f = ['wdis(100d6)', 'wdis(100d6)'].join('+');
    expect(() => rollFormula(f)).toThrow(FormulaError);
  });

  it('a single weighted-advantage group of 100 dice (300 effective) stays under the cap', () => {
    const result = rollFormula('wadv(100d6)');
    expect(result.total).toEqual(expect.any(Number));
  });

  it('applies the 3x multiplier for balance groups', () => {
    // 2 * bal(100d6): raw count = 200, but 200 * 3 = 600 > 500
    const f = ['bal(100d6)', 'bal(100d6)'].join('+');
    expect(() => rollFormula(f)).toThrow(FormulaError);
    expect(() => rollFormula(f)).toThrow(/Забагато кубиків/);
  });

  it('a single balance group of 100 dice (300 effective) stays under the cap', () => {
    const result = rollFormula('bal(100d6)');
    expect(result.total).toEqual(expect.any(Number));
  });

  it('applies the 2x multiplier for extremum groups', () => {
    // 3 * ext(100d6): raw count = 300, but 300 * 2 = 600 > 500
    const f = ['ext(100d6)', 'ext(100d6)', 'ext(100d6)'].join('+');
    expect(() => rollFormula(f)).toThrow(FormulaError);
    expect(() => rollFormula(f)).toThrow(/Забагато кубиків/);
  });

  it('a single extremum group of 100 dice (200 effective) stays under the cap', () => {
    const result = rollFormula('ext(100d6)');
    expect(result.total).toEqual(expect.any(Number));
  });

  it('does not count modifier terms towards the dice total', () => {
    // 5 * 100d6 = 500 (at the cap, not over) plus a bunch of flat modifiers
    const f = ['100d6', '100d6', '100d6', '100d6', '100d6', '1', '2', '3'].join('+');
    expect(() => rollFormula(f)).not.toThrow();
  });
});
