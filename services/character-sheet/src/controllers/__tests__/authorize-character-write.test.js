jest.mock('../../models/character.model');
jest.mock('../../models/campaign-access.model');

const CharacterModel = require('../../models/character.model');
const { isCampaignGmForCharacter } = require('../../models/campaign-access.model');
const authorizeCharacterWrite = require('../authorize-character-write');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

beforeEach(() => jest.clearAllMocks());

describe('authorizeCharacterWrite', () => {
  it('404s and returns null when the character does not exist', async () => {
    CharacterModel.findById.mockResolvedValue(null);
    const req = { params: { id: 'c1' }, user: { sub: 'u1' } };
    const res = mockRes();

    const result = await authorizeCharacterWrite(req, res);

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Персонажа не знайдено' });
    expect(isCampaignGmForCharacter).not.toHaveBeenCalled();
  });

  it('allows and returns the character when the requester is its owner', async () => {
    const char = { id: 'c1', user_id: 'u1' };
    CharacterModel.findById.mockResolvedValue(char);
    const req = { params: { id: 'c1' }, user: { sub: 'u1' } };
    const res = mockRes();

    const result = await authorizeCharacterWrite(req, res);

    expect(result).toBe(char);
    expect(res.status).not.toHaveBeenCalled();
    // Owner short-circuits before the campaign lookup.
    expect(isCampaignGmForCharacter).not.toHaveBeenCalled();
  });

  it('allows a non-owner who is GM of a campaign the character belongs to', async () => {
    const char = { id: 'c1', user_id: 'owner-1' };
    CharacterModel.findById.mockResolvedValue(char);
    isCampaignGmForCharacter.mockResolvedValue(true);
    const req = { params: { id: 'c1' }, user: { sub: 'gm-1' } };
    const res = mockRes();

    const result = await authorizeCharacterWrite(req, res);

    expect(result).toBe(char);
    expect(isCampaignGmForCharacter).toHaveBeenCalledWith('c1', 'gm-1');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('403s and returns null when neither owner nor campaign GM', async () => {
    const char = { id: 'c1', user_id: 'owner-1' };
    CharacterModel.findById.mockResolvedValue(char);
    isCampaignGmForCharacter.mockResolvedValue(false);
    const req = { params: { id: 'c1' }, user: { sub: 'stranger' } };
    const res = mockRes();

    const result = await authorizeCharacterWrite(req, res);

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Доступ заборонено' });
  });
});
