jest.mock('../../models/character-state.model');
jest.mock('../../models/campaign-access.model');

const CharacterStateModel = require('../../models/character-state.model');
const { isCampaignGmForCharacter } = require('../../models/campaign-access.model');
const TimerController = require('../timer.controller');

const ID1 = '11111111-1111-1111-1111-111111111111';
const ID2 = '22222222-2222-2222-2222-222222222222';

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

const req = (body, user = { sub: 'gm-1', role: 'user' }) => ({ body, user });

function mockLock() {
  CharacterStateModel.withCharacterLock.mockImplementation((id, fn) => fn({}, {
    character: { id, name: `Ч-${id[0]}`, archetype: 'rogue', conditions: [], rest_timer_hours: 0, timer_checks_done: 0, timer_checks_passed: 0 },
    skills: [],
  }));
  CharacterStateModel.saveState.mockImplementation(async (client, id, fields) => ({ id, ...fields }));
}

beforeEach(() => jest.clearAllMocks());

describe('TimerController.advance', () => {
  it('validates ids, hours and source_key', async () => {
    for (const body of [
      { character_ids: [], hours: 1 },
      { character_ids: ['nope'], hours: 1 },
      { character_ids: [ID1], hours: 0 },
      { character_ids: [ID1], hours: 'abc' },
      { character_ids: [ID1], hours: 1, source_key: '  ' },
    ]) {
      const res = mockRes();
      await TimerController.advance(req(body), res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });

  it('forbids the owner (not the campaign GM) from advancing the timer', async () => {
    isCampaignGmForCharacter.mockResolvedValue(false);
    const res = mockRes();

    await TimerController.advance(req({ character_ids: [ID1], hours: 4 }, { sub: 'owner-1', role: 'user' }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(CharacterStateModel.withCharacterLock).not.toHaveBeenCalled();
  });

  it('lets the campaign GM advance the timer and reports Fatigue checks', async () => {
    isCampaignGmForCharacter.mockResolvedValue(true);
    mockLock();
    const res = mockRes();

    await TimerController.advance(req({ character_ids: [ID1, ID2], hours: 12 }), res);

    const { results } = res.json.mock.calls[0][0];
    expect(results).toHaveLength(2);
    // Без навичок Витривалість 1 → без кубика → провал.
    expect(results[0]).toMatchObject({ character_id: ID1, skipped: false, hours_added: 12, fatigue_before: 0, fatigue_after: 1 });
    expect(results[0].checks[0]).toMatchObject({ threshold: 12, roll: 0, success: false });
    expect(results[0].timer).toEqual({ hours: 12, next_check_at: 18, checks_done: 1, checks_passed: 0 });
  });

  it('lets an admin through without a campaign check', async () => {
    mockLock();
    const res = mockRes();
    await TimerController.advance(req({ character_ids: [ID1], hours: 1 }, { sub: 'a', role: 'admin' }), res);
    expect(isCampaignGmForCharacter).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].results[0].skipped).toBe(false);
  });

  it('applies a source_key only once', async () => {
    isCampaignGmForCharacter.mockResolvedValue(true);
    mockLock();
    CharacterStateModel.insertTimerEvent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const first = mockRes();
    await TimerController.advance(req({ character_ids: [ID1], hours: 3, source_key: 'combat:s1' }), first);
    const second = mockRes();
    await TimerController.advance(req({ character_ids: [ID1], hours: 3, source_key: 'combat:s1' }), second);

    expect(CharacterStateModel.insertTimerEvent).toHaveBeenCalledWith({}, ID1, 'combat:s1', 3);
    expect(first.json.mock.calls[0][0].results[0].skipped).toBe(false);
    expect(second.json.mock.calls[0][0].results[0]).toMatchObject({ skipped: true, reason: 'already_applied' });
    expect(CharacterStateModel.saveState).toHaveBeenCalledTimes(1);
  });

  it('reports a missing character as skipped', async () => {
    CharacterStateModel.withCharacterLock.mockResolvedValue(null);
    const res = mockRes();
    await TimerController.advance(req({ character_ids: [ID1], hours: 1 }, { sub: 'a', role: 'admin' }), res);
    expect(res.json.mock.calls[0][0].results[0]).toEqual({ character_id: ID1, skipped: true, reason: 'not_found' });
  });
});
