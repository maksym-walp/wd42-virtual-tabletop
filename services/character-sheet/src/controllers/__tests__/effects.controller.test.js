jest.mock('../../models/character-state.model');

const CharacterStateModel = require('../../models/character-state.model');
const EffectsController = require('../effects.controller');

const ID1 = '11111111-1111-1111-1111-111111111111';

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

beforeEach(() => jest.clearAllMocks());

describe('EffectsController.list', () => {
  it('returns nothing without valid ids and does not query', async () => {
    const res = mockRes();
    await EffectsController.list({ query: { ids: 'x,y' }, user: { sub: 'u1' } }, res);
    expect(res.json).toHaveBeenCalledWith({ characters: {} });
    expect(CharacterStateModel.findVisible).not.toHaveBeenCalled();
  });

  it('returns effects only for visible characters', async () => {
    CharacterStateModel.findVisible.mockResolvedValue([
      { id: ID1, archetype: 'fighter', conditions: [{ type: 'fatigue', level: 2 }], heroic_actions_used: 0 },
    ]);
    CharacterStateModel.findSkills.mockResolvedValue([]);
    const res = mockRes();

    await EffectsController.list({ query: { ids: `${ID1},22222222-2222-2222-2222-222222222222` }, user: { sub: 'u1', role: 'user' } }, res);

    expect(CharacterStateModel.findVisible).toHaveBeenCalledWith(
      [ID1, '22222222-2222-2222-2222-222222222222'], 'u1', false
    );
    const { characters } = res.json.mock.calls[0][0];
    expect(Object.keys(characters)).toEqual([ID1]);
    expect(characters[ID1].effects).toMatchObject({ initiative_modifier: -2, roll_mode: 'dis', heroic_disabled: true });
  });
});
