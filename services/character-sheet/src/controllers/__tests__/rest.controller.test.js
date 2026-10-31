jest.mock('../../models/character-state.model');
jest.mock('../../models/skill.model');
jest.mock('../../models/tree-modifiers.model');
jest.mock('../authorize-character-write');

const CharacterStateModel = require('../../models/character-state.model');
const SkillModel = require('../../models/skill.model');
const authorizeCharacterWrite = require('../authorize-character-write');
const RestController = require('../rest.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

const character = (overrides = {}) => ({
  id: 'c1', archetype: 'rogue', conditions: [], death_scale: null,
  current_hp: 10, current_magic: 0, heroic_actions_used: 1,
  health_dice_values: [5, 5, 5, 5, 5, 5], rest_timer_hours: 20, timer_checks_done: 2, timer_checks_passed: 1,
  ...overrides,
});

function mockLock(char) {
  CharacterStateModel.withCharacterLock.mockImplementation((id, fn) => fn({}, { character: char, skills: [] }));
  CharacterStateModel.saveState.mockImplementation(async (client, id, fields) => ({ ...char, ...fields }));
}

const req = (body, user = { sub: 'owner-1', username: 'owner' }) => ({ params: { id: 'c1' }, body, user });

beforeEach(() => jest.clearAllMocks());

describe('RestController.rest', () => {
  it('stops when the write is not authorized', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    await RestController.rest(req({ kind: 'full' }), mockRes());
    expect(CharacterStateModel.withCharacterLock).not.toHaveBeenCalled();
  });

  it('400s on an unknown kind', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    const res = mockRes();
    await RestController.rest(req({ kind: 'nap' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('answers choice_required with the options when the choice is missing', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    mockLock(character({ conditions: [{ type: 'fatigue', level: 1 }, { type: 'illness', level: 1 }] }));
    const res = mockRes();

    await RestController.rest(req({ kind: 'full' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'choice_required', options: ['fatigue', 'illness'] }));
    expect(CharacterStateModel.saveState).not.toHaveBeenCalled();
  });

  it('applies the rest, stores last_rest with who pressed it and returns the result', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    mockLock(character({ conditions: [{ type: 'fatigue', level: 1 }, { type: 'illness', level: 1 }] }));
    const res = mockRes();

    await RestController.rest(req({ kind: 'full', choice: { condition: 'fatigue' } }, { sub: 'gm-1', username: 'gm' }), res);

    const fields = CharacterStateModel.saveState.mock.calls[0][2];
    expect(fields.conditions).toEqual([{ type: 'illness', level: 1 }]);
    expect(fields).toMatchObject({ rest_timer_hours: 0, timer_checks_done: 0, heroic_actions_used: 0 });
    expect(fields.last_rest).toMatchObject({ kind: 'full', by: { user_id: 'gm-1', username: 'gm' } });
    const payload = res.json.mock.calls[0][0];
    expect(payload.result.conditions_removed).toEqual([{ type: 'fatigue', from: 1, to: 0 }]);
    expect(payload.timer.hours).toBe(0);
  });

  it('404s when the character disappeared', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    CharacterStateModel.withCharacterLock.mockResolvedValue(null);
    const res = mockRes();
    await RestController.rest(req({ kind: 'long' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('RestController.preview', () => {
  it('describes all three rests for whoever may rest', async () => {
    authorizeCharacterWrite.mockResolvedValue(character());
    SkillModel.findAll.mockResolvedValue([]);
    const res = mockRes();

    await RestController.preview(req({}), res);

    const { preview } = res.json.mock.calls[0][0];
    expect(Object.keys(preview)).toEqual(['short', 'full', 'long']);
    expect(preview.full.lines.length).toBeGreaterThan(0);
    expect(CharacterStateModel.saveState).not.toHaveBeenCalled();
  });

  it('stops when the write is not authorized', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    await RestController.preview(req({}), mockRes());
    expect(SkillModel.findAll).not.toHaveBeenCalled();
  });
});
