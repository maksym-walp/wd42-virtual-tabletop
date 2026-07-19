const { tokenize } = require('../tokenizer');
const { FormulaError } = require('../errors');

describe('tokenize', () => {
  it('tokenizes a simple dice group', () => {
    expect(tokenize('2d20')).toEqual([{ type: 'dice', count: 2, sides: 20 }]);
  });

  it('tokenizes a full mixed formula', () => {
    expect(tokenize('2d20+1d8+adv(1d10)-5')).toEqual([
      { type: 'dice', count: 2, sides: 20 },
      { type: '+' },
      { type: 'dice', count: 1, sides: 8 },
      { type: '+' },
      { type: 'mod', value: 'adv' },
      { type: '(' },
      { type: 'dice', count: 1, sides: 10 },
      { type: ')' },
      { type: '-' },
      { type: 'int', value: 5 },
    ]);
  });

  it('recognizes wadv/wdis keywords', () => {
    expect(tokenize('wadv(3d6)')).toEqual([
      { type: 'mod', value: 'wadv' },
      { type: '(' },
      { type: 'dice', count: 3, sides: 6 },
      { type: ')' },
    ]);
    expect(tokenize('wdis(1d20)')).toEqual([
      { type: 'mod', value: 'wdis' },
      { type: '(' },
      { type: 'dice', count: 1, sides: 20 },
      { type: ')' },
    ]);
  });

  it('recognizes bal/ext keywords', () => {
    expect(tokenize('bal(3d6)')).toEqual([
      { type: 'mod', value: 'bal' },
      { type: '(' },
      { type: 'dice', count: 3, sides: 6 },
      { type: ')' },
    ]);
    expect(tokenize('ext(1d20)')).toEqual([
      { type: 'mod', value: 'ext' },
      { type: '(' },
      { type: 'dice', count: 1, sides: 20 },
      { type: ')' },
    ]);
  });

  it('is case-insensitive on keywords and the d separator', () => {
    expect(tokenize('ADV(1D20)')).toEqual([
      { type: 'mod', value: 'adv' },
      { type: '(' },
      { type: 'dice', count: 1, sides: 20 },
      { type: ')' },
    ]);
  });

  it('skips whitespace between tokens', () => {
    expect(tokenize('2d6 + 3')).toEqual([
      { type: 'dice', count: 2, sides: 6 },
      { type: '+' },
      { type: 'int', value: 3 },
    ]);
  });

  it('throws FormulaError on an unrecognized character', () => {
    expect(() => tokenize('2d6 * 3')).toThrow(FormulaError);
  });
});
