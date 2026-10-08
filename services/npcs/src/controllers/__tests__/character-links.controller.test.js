jest.mock('../../models/relationship.model');
jest.mock('../../models/faction.model');
jest.mock('../../models/character-access.model');

const RelationshipModel = require('../../models/relationship.model');
const FactionModel = require('../../models/faction.model');
const CharacterAccessModel = require('../../models/character-access.model');
const CharacterLinksController = require('../character-links.controller');

const CHAR = '11111111-1111-4111-8111-111111111111';

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}
const req = (user, characterId = CHAR) => ({ params: { characterId }, user });

beforeEach(() => jest.clearAllMocks());

describe('CharacterLinksController.relationships', () => {
  it('lists relationships for a character the viewer can see', async () => {
    CharacterAccessModel.canView.mockResolvedValue(true);
    RelationshipModel.findByCharacterTarget.mockResolvedValue([{ id: 'r1' }]);
    const res = mockRes();

    await CharacterLinksController.relationships(req({ sub: 'u1', role: 'user' }), res);

    expect(CharacterAccessModel.canView).toHaveBeenCalledWith(CHAR, 'u1');
    expect(RelationshipModel.findByCharacterTarget).toHaveBeenCalledWith(CHAR, 'u1', false);
    expect(res.json).toHaveBeenCalledWith({ relationships: [{ id: 'r1' }] });
  });

  it('404s a private character of someone else', async () => {
    CharacterAccessModel.canView.mockResolvedValue(false);
    const res = mockRes();

    await CharacterLinksController.relationships(req({ sub: 'u2', role: 'user' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(RelationshipModel.findByCharacterTarget).not.toHaveBeenCalled();
  });

  it('lets admins and game masters through without the ownership lookup', async () => {
    RelationshipModel.findByCharacterTarget.mockResolvedValue([]);
    await CharacterLinksController.relationships(req({ sub: 'a', role: 'admin' }), mockRes());
    await CharacterLinksController.relationships(req({ sub: 'g', role: 'game_master' }), mockRes());

    expect(CharacterAccessModel.canView).not.toHaveBeenCalled();
    expect(RelationshipModel.findByCharacterTarget).toHaveBeenCalledWith(CHAR, 'a', true);
    expect(RelationshipModel.findByCharacterTarget).toHaveBeenCalledWith(CHAR, 'g', false);
  });

  it('400s a malformed id', async () => {
    const res = mockRes();
    await CharacterLinksController.relationships(req({ sub: 'u1' }, 'nope'), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('CharacterLinksController.factions', () => {
  it('lists faction memberships with roles', async () => {
    CharacterAccessModel.canView.mockResolvedValue(true);
    FactionModel.findMembershipsByCharacter.mockResolvedValue([{ id: 'f1', role: 'Розвідник' }]);
    const res = mockRes();

    await CharacterLinksController.factions(req({ sub: 'u1', role: 'user' }), res);

    expect(FactionModel.findMembershipsByCharacter).toHaveBeenCalledWith(CHAR, 'u1', false);
    expect(res.json).toHaveBeenCalledWith({ factions: [{ id: 'f1', role: 'Розвідник' }] });
  });
});
