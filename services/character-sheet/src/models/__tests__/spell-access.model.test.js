jest.mock('../../config/db');
jest.mock('../campaign-access.model');

const pool = require('../../config/db');
const { isCampaignGmForCharacter } = require('../campaign-access.model');
const { evaluateSpellAccess, treeSpellAccess, isSpellMaster } = require('../spell-access.model');

beforeEach(() => jest.clearAllMocks());

const spell = (traditionIds, ...complexities) => ({
  traditionIds,
  forms: complexities.map((complexity, i) => ({ key: i === 0 ? 'main' : `f${i}`, complexity })),
});

describe('evaluateSpellAccess', () => {
  const access = { traditions: ['fire'], maxComplexity: 'medium' };

  it('needs an opened tradition AND complexity', () => {
    expect(evaluateSpellAccess(access, spell(['fire'], 'simple'))).toEqual({ met: true, allowedForms: null, missing: {} });
    expect(evaluateSpellAccess(access, spell(['ice'], 'simple'))).toMatchObject({ met: false, missing: { traditionIds: ['ice'] } });
    expect(evaluateSpellAccess(access, spell(['fire'], 'complex'))).toMatchObject({ met: false, missing: { complexity: 'complex' } });
  });

  it('opens complexity as a ladder', () => {
    expect(evaluateSpellAccess(access, spell([], 'primitive')).met).toBe(true);
    expect(evaluateSpellAccess(access, spell([], 'medium')).met).toBe(true);
    expect(evaluateSpellAccess({ traditions: [], maxComplexity: null }, spell([], 'primitive')).met).toBe(false);
  });

  it('skips a condition the spell does not have', () => {
    expect(evaluateSpellAccess({ traditions: [], maxComplexity: null }, spell([], null)).met).toBe(true);
    expect(evaluateSpellAccess(access, spell(['fire'], null)).met).toBe(true);
  });

  it('opens only the forms within the complexity', () => {
    expect(evaluateSpellAccess(access, spell(['fire'], 'complex', 'simple', 'extreme')))
      .toEqual({ met: true, allowedForms: ['f1'], missing: {} });
  });
});

describe('treeSpellAccess', () => {
  it('unions traditions and keeps the highest complexity of the unlocked nodes', async () => {
    pool.query.mockResolvedValue({ rows: [
      { unlocks_traditions: ['a'], unlocks_complexity: 'simple' },
      { unlocks_traditions: ['a', 'b'], unlocks_complexity: 'complex' },
      { unlocks_traditions: [], unlocks_complexity: null },
    ] });
    expect(await treeSpellAccess('c1')).toEqual({ traditions: ['a', 'b'], maxComplexity: 'complex' });
    expect(pool.query.mock.calls[0][1]).toEqual(['c1']);
  });
});

describe('isSpellMaster', () => {
  it('is true for a global GM/admin without a campaign lookup', async () => {
    expect(await isSpellMaster({ user: { sub: 'u', role: 'game_master' } }, 'c1')).toBe(true);
    expect(await isSpellMaster({ user: { sub: 'u', role: 'admin' } }, 'c1')).toBe(true);
    expect(isCampaignGmForCharacter).not.toHaveBeenCalled();
  });

  it('falls back to the character\'s campaign GM', async () => {
    isCampaignGmForCharacter.mockResolvedValue(true);
    expect(await isSpellMaster({ user: { sub: 'u', role: 'player' } }, 'c1')).toBe(true);
    expect(isCampaignGmForCharacter).toHaveBeenCalledWith('c1', 'u');
  });
});
