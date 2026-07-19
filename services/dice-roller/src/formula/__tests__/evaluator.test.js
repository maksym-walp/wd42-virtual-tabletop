const crypto = require('crypto');
const { evaluate } = require('../evaluator');

describe('evaluate', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sums a plain dice group and reports every roll', () => {
    jest.spyOn(crypto, 'randomInt').mockReturnValueOnce(4).mockReturnValueOnce(6);
    const { groups, total } = evaluate([
      { sign: 1, node: { kind: 'dice', count: 2, sides: 8 } },
    ]);
    expect(groups).toEqual([
      { type: 'dice', sides: 8, rolls: [4, 6], sign: 1, subtotal: 10 },
    ]);
    expect(total).toBe(10);
  });

  it('applies a signed flat modifier', () => {
    const { groups, total } = evaluate([
      { sign: -1, node: { kind: 'modifier', value: 5 } },
    ]);
    expect(groups).toEqual([{ type: 'modifier', value: 5, sign: -1, subtotal: -5 }]);
    expect(total).toBe(-5);
  });

  it('keeps the higher roll for advantage', () => {
    jest.spyOn(crypto, 'randomInt').mockReturnValueOnce(3).mockReturnValueOnce(9);
    const { groups, total } = evaluate([
      { sign: 1, node: { kind: 'wrapped', mode: 'adv', count: 1, sides: 10 } },
    ]);
    expect(groups).toEqual([
      { type: 'adv', sides: 10, dice: [{ rolls: [3, 9], kept: 9 }], sign: 1, subtotal: 9 },
    ]);
    expect(total).toBe(9);
  });

  it('keeps the lower roll for disadvantage', () => {
    jest.spyOn(crypto, 'randomInt').mockReturnValueOnce(7).mockReturnValueOnce(2);
    const { groups } = evaluate([
      { sign: 1, node: { kind: 'wrapped', mode: 'dis', count: 1, sides: 20 } },
    ]);
    expect(groups[0].dice[0]).toEqual({ rolls: [7, 2], kept: 2 });
  });

  it('rolls 3 and keeps the best for double advantage (wadv)', () => {
    jest.spyOn(crypto, 'randomInt').mockReturnValueOnce(2).mockReturnValueOnce(5).mockReturnValueOnce(1);
    const { groups } = evaluate([
      { sign: 1, node: { kind: 'wrapped', mode: 'wadv', count: 1, sides: 6 } },
    ]);
    expect(groups[0].dice[0]).toEqual({ rolls: [2, 5, 1], kept: 5 });
  });

  it('rolls 3 and keeps the worst for double disadvantage (wdis)', () => {
    jest.spyOn(crypto, 'randomInt').mockReturnValueOnce(4).mockReturnValueOnce(6).mockReturnValueOnce(1);
    const { groups } = evaluate([
      { sign: 1, node: { kind: 'wrapped', mode: 'wdis', count: 1, sides: 6 } },
    ]);
    expect(groups[0].dice[0]).toEqual({ rolls: [4, 6, 1], kept: 1 });
  });

  it('rolls 3 and keeps the median for balance (bal)', () => {
    jest.spyOn(crypto, 'randomInt').mockReturnValueOnce(9).mockReturnValueOnce(3).mockReturnValueOnce(12);
    const { groups } = evaluate([
      { sign: 1, node: { kind: 'wrapped', mode: 'bal', count: 1, sides: 20 } },
    ]);
    expect(groups[0].dice[0]).toEqual({ rolls: [9, 3, 12], kept: 9 });
  });

  it('keeps whichever roll is closer to an edge for extremum (ext)', () => {
    jest.spyOn(crypto, 'randomInt').mockReturnValueOnce(17).mockReturnValueOnce(9);
    const { groups } = evaluate([
      { sign: 1, node: { kind: 'wrapped', mode: 'ext', count: 1, sides: 20 } },
    ]);
    expect(groups[0]).toEqual({
      type: 'ext', sides: 20, dice: [{ rolls: [17, 9], kept: 17 }], sign: 1, subtotal: 17,
    });
  });

  it('rerolls both extremum dice on a tied distance-to-edge', () => {
    jest.spyOn(crypto, 'randomInt')
      .mockReturnValueOnce(2).mockReturnValueOnce(19) // tie: both at distance 1 from an edge
      .mockReturnValueOnce(5).mockReturnValueOnce(14); // resolves: distance 4 vs 6
    const { groups } = evaluate([
      { sign: 1, node: { kind: 'wrapped', mode: 'ext', count: 1, sides: 20 } },
    ]);
    expect(groups[0].dice[0]).toEqual({ rolls: [5, 14], kept: 5 });
    expect(crypto.randomInt).toHaveBeenCalledTimes(4);
  });

  it('evaluates advantage over a multi-dice group per-die', () => {
    jest.spyOn(crypto, 'randomInt')
      .mockReturnValueOnce(1).mockReturnValueOnce(6) // die 1: keep 6
      .mockReturnValueOnce(4).mockReturnValueOnce(3); // die 2: keep 4
    const { groups } = evaluate([
      { sign: 1, node: { kind: 'wrapped', mode: 'adv', count: 2, sides: 6 } },
    ]);
    expect(groups[0].dice).toEqual([
      { rolls: [1, 6], kept: 6 },
      { rolls: [4, 3], kept: 4 },
    ]);
    expect(groups[0].subtotal).toBe(10);
  });

  it('sums signed subtotals across groups into a final total', () => {
    jest.spyOn(crypto, 'randomInt')
      .mockReturnValueOnce(14).mockReturnValueOnce(7) // 2d20
      .mockReturnValueOnce(5)                          // 1d8
      .mockReturnValueOnce(3).mockReturnValueOnce(9);  // adv(1d10)
    const { total } = evaluate([
      { sign: 1, node: { kind: 'dice', count: 2, sides: 20 } },
      { sign: 1, node: { kind: 'dice', count: 1, sides: 8 } },
      { sign: 1, node: { kind: 'wrapped', mode: 'adv', count: 1, sides: 10 } },
      { sign: -1, node: { kind: 'modifier', value: 5 } },
    ]);
    // (14+7) + 5 + 9 - 5 = 30
    expect(total).toBe(30);
  });
});
