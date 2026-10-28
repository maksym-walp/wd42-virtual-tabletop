jest.mock('../../models/campaign.model');
jest.mock('../../models/campaign-character.model');
jest.mock('../../clients/character-sheet.client');
jest.mock('../../realtime/bus');

const CampaignModel = require('../../models/campaign.model');
const CampaignCharacterModel = require('../../models/campaign-character.model');
const CharacterSheetClient = require('../../clients/character-sheet.client');
const bus = require('../../realtime/bus');
const TimerController = require('../timer.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

const req = (body, user = { sub: 'gm-1' }) => ({
  params: { id: 'camp-1' }, body, user, headers: { authorization: 'Bearer gm' },
});

beforeEach(() => {
  jest.clearAllMocks();
  CampaignModel.findById.mockResolvedValue({ id: 'camp-1', gm_id: 'gm-1' });
});

describe('TimerController.advance', () => {
  it('403s for a non-GM', async () => {
    const res = mockRes();
    await TimerController.advance(req({ hours: 4 }, { sub: 'player-1' }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CharacterSheetClient.advanceTimer).not.toHaveBeenCalled();
  });

  it('accepts only the 1/4/8/12-hour steps', async () => {
    for (const hours of [0, 2, 24, 'x']) {
      const res = mockRes();
      await TimerController.advance(req({ hours }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });

  it('advances every attached character, publishes characters and lists who got Fatigue', async () => {
    CampaignCharacterModel.listCharacterIds.mockResolvedValue(['a', 'b']);
    CharacterSheetClient.advanceTimer.mockResolvedValue({
      results: [
        { character_id: 'a', name: 'А', skipped: false, fatigue_before: 0, fatigue_after: 1, checks: [{ threshold: 12 }] },
        { character_id: 'b', name: 'Б', skipped: false, fatigue_before: 0, fatigue_after: 0, checks: [] },
      ],
    });
    const res = mockRes();

    await TimerController.advance(req({ hours: 12 }), res);

    expect(CharacterSheetClient.advanceTimer).toHaveBeenCalledWith('Bearer gm', { characterIds: ['a', 'b'], hours: 12 });
    expect(bus.publish).toHaveBeenCalledWith('camp-1', 'characters');
    const payload = res.json.mock.calls[0][0];
    expect(payload.results).toHaveLength(2);
    expect(payload.notifications).toEqual([
      { character_id: 'a', name: 'А', fatigue_before: 0, fatigue_after: 1, checks: [{ threshold: 12 }] },
    ]);
  });

  it('answers with an empty list for a campaign without characters', async () => {
    CampaignCharacterModel.listCharacterIds.mockResolvedValue([]);
    const res = mockRes();
    await TimerController.advance(req({ hours: 1 }), res);
    expect(res.json).toHaveBeenCalledWith({ results: [], notifications: [] });
    expect(CharacterSheetClient.advanceTimer).not.toHaveBeenCalled();
  });

  it('propagates a 502 from the character-sheet client without publishing', async () => {
    CampaignCharacterModel.listCharacterIds.mockResolvedValue(['a']);
    const err = Object.assign(new Error('Сервіс листів персонажів недоступний'), { statusCode: 502 });
    CharacterSheetClient.advanceTimer.mockRejectedValue(err);

    await expect(TimerController.advance(req({ hours: 1 }), mockRes())).rejects.toBe(err);
    expect(bus.publish).not.toHaveBeenCalled();
  });
});
