jest.mock('../../models/character-state.model');
jest.mock('../../models/tree-modifiers.model');
jest.mock('../../models/equipment.model');
jest.mock('../../models/spell.model');
jest.mock('../../models/spell-access.model');

const CharacterStateModel = require('../../models/character-state.model');
const { treeModifiersForMany, treeCastSkillOptionsForMany } = require('../../models/tree-modifiers.model');
const EquipmentModel = require('../../models/equipment.model');
const SpellProgressModel = require('../../models/spell.model');
const { treeSpellAccessForMany } = require('../../models/spell-access.model');
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

  it('includes the archetype, weapons and roll profiles the combat tracker needs', async () => {
    CharacterStateModel.findVisible.mockResolvedValue([
      { id: ID1, archetype: 'fighter', conditions: [], heroic_actions_used: 0, health_dice_values: [] },
    ]);
    CharacterStateModel.findSkills.mockResolvedValue([]);
    treeModifiersForMany.mockResolvedValue({});
    EquipmentModel.weaponsForMany.mockResolvedValue({
      [ID1]: [{ equipment_id: 'w1', name: 'Меч', damage_die: 'd8', modifier: 'strength', mastered: true }],
    });

    const res = mockRes();
    await EffectsController.list({ query: { ids: ID1 }, user: { sub: 'u1' } }, res);

    const entry = res.json.mock.calls[0][0].characters[ID1];
    // Архетип потрібен правилу повторення дій (4.10) — без нього боєць
    // хибно отримував би перешкоду на другу атаку за хід.
    expect(entry.archetype).toBe('fighter');
    expect(entry.weapons).toHaveLength(1);
    expect(entry.roll_profiles.evasion).toBeDefined();
    expect(entry.roll_profiles.damage_dice.count).toBe(1);
  });

  it('includes combat spells, spell access, cast-skill options and current_magic for casting', async () => {
    CharacterStateModel.findVisible.mockResolvedValue([
      { id: ID1, archetype: 'spellcaster', conditions: [], heroic_actions_used: 0, current_magic: 7 },
    ]);
    CharacterStateModel.findSkills.mockResolvedValue([]);
    SpellProgressModel.combatSpellsForMany.mockResolvedValue({
      [ID1]: [{ spell_id: 's1', name: 'Вогняна куля', mastered: true, gm_granted: false, damage_die: 'd8', energy_cost: 3, forms: [] }],
    });
    treeSpellAccessForMany.mockResolvedValue({ [ID1]: { traditions: ['t1'], maxComplexity: 'simple' } });
    treeCastSkillOptionsForMany.mockResolvedValue({ [ID1]: [{ id: 'o1', magic_form: 'pact', skill_key: 'will' }] });

    const res = mockRes();
    await EffectsController.list({ query: { ids: ID1 }, user: { sub: 'u1' } }, res);

    const entry = res.json.mock.calls[0][0].characters[ID1];
    expect(entry.current_magic).toBe(7);
    expect(entry.spells).toEqual([{ spell_id: 's1', name: 'Вогняна куля', mastered: true, gm_granted: false, damage_die: 'd8', energy_cost: 3, forms: [] }]);
    expect(entry.spell_access).toEqual({ traditions: ['t1'], max_complexity: 'simple' });
    expect(entry.cast_skill_options).toEqual([{ id: 'o1', magic_form: 'pact', skill_key: 'will' }]);
  });

  it('defaults spells/spell_access/cast_skill_options when a character has none', async () => {
    CharacterStateModel.findVisible.mockResolvedValue([
      { id: ID1, archetype: 'fighter', conditions: [], heroic_actions_used: 0 },
    ]);
    CharacterStateModel.findSkills.mockResolvedValue([]);
    // jest.clearAllMocks() (beforeEach) wipes call history, not resolved
    // values a previous test set — make this test's "nothing configured"
    // premise explicit rather than relying on mock leakage/non-leakage.
    SpellProgressModel.combatSpellsForMany.mockResolvedValue(undefined);
    treeSpellAccessForMany.mockResolvedValue(undefined);
    treeCastSkillOptionsForMany.mockResolvedValue(undefined);

    const res = mockRes();
    await EffectsController.list({ query: { ids: ID1 }, user: { sub: 'u1' } }, res);

    const entry = res.json.mock.calls[0][0].characters[ID1];
    expect(entry.spells).toEqual([]);
    expect(entry.spell_access).toEqual({ traditions: [], max_complexity: null });
    expect(entry.cast_skill_options).toEqual([]);
  });
});
