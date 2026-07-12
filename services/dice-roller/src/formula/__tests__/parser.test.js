const { tokenize } = require('../tokenizer');
const { parse } = require('../parser');
const { FormulaError } = require('../errors');

const parseFormula = (str) => parse(tokenize(str));

describe('parse', () => {
  it('parses a single dice group', () => {
    expect(parseFormula('2d20')).toEqual([
      { sign: 1, node: { kind: 'dice', count: 2, sides: 20 } },
    ]);
  });

  it('parses a leading negative sign', () => {
    expect(parseFormula('-5')).toEqual([
      { sign: -1, node: { kind: 'modifier', value: 5 } },
    ]);
  });

  it('parses the full example formula from the spec', () => {
    expect(parseFormula('2d20+1d8+adv(1d10)-5')).toEqual([
      { sign: 1, node: { kind: 'dice', count: 2, sides: 20 } },
      { sign: 1, node: { kind: 'dice', count: 1, sides: 8 } },
      { sign: 1, node: { kind: 'wrapped', mode: 'adv', count: 1, sides: 10 } },
      { sign: -1, node: { kind: 'modifier', value: 5 } },
    ]);
  });

  it('allows adv()/dis() to wrap a multi-dice group', () => {
    expect(parseFormula('wadv(3d6)')).toEqual([
      { sign: 1, node: { kind: 'wrapped', mode: 'wadv', count: 3, sides: 6 } },
    ]);
  });

  it('rejects a dangling operator', () => {
    expect(() => parseFormula('2d6+')).toThrow(FormulaError);
  });

  it('rejects a wrapped group missing parens', () => {
    expect(() => parseFormula('adv 1d10')).toThrow(FormulaError);
  });

  it('rejects a wrapped group around a bare modifier', () => {
    expect(() => parseFormula('adv(5)')).toThrow(FormulaError);
  });

  it('rejects an empty formula', () => {
    expect(() => parse([])).toThrow(FormulaError);
  });

  it('rejects a die with fewer than 2 sides', () => {
    expect(() => parseFormula('1d1')).toThrow(FormulaError);
  });

  it('rejects more than 100 dice in a single group', () => {
    expect(() => parseFormula('101d6')).toThrow(FormulaError);
  });
});
