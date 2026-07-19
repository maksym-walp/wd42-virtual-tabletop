jest.mock('../../models/character.model');
jest.mock('../../models/skill.model');
jest.mock('../../models/spell.model');
jest.mock('../../models/tree-progress.model');
jest.mock('../../models/nephilim-breakthrough.model');
jest.mock('../../models/equipment.model');
jest.mock('../../models/maneuver.model');
jest.mock('../../models/ability.model');
jest.mock('../../models/ritual-tracker.model');
jest.mock('../../models/campaign-access.model');
jest.mock('../authorize-character-write');

const CharacterModel = require('../../models/character.model');
const SkillModel = require('../../models/skill.model');
const SpellProgressModel = require('../../models/spell.model');
const TreeProgressModel = require('../../models/tree-progress.model');
const NephilimBreakthroughModel = require('../../models/nephilim-breakthrough.model');
const EquipmentModel = require('../../models/equipment.model');
const ManeuverModel = require('../../models/maneuver.model');
const AbilityModel = require('../../models/ability.model');
const RitualTrackerModel = require('../../models/ritual-tracker.model');
const { isCampaignGmForCharacter } = require('../../models/campaign-access.model');
const authorizeCharacterWrite = require('../authorize-character-write');
const CharacterController = require('../character.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq(overrides = {}) {
  return { params: {}, body: {}, user: { sub: 'user-1' }, ...overrides };
}

// Wires up every model touched by the Promise.all aggregation with a
// distinct, recognizable value so the response shape can be asserted precisely.
function mockAggregationModels() {
  SkillModel.findAll.mockResolvedValue(['skill-x']);
  SpellProgressModel.findAll.mockResolvedValue(['spell-x']);
  TreeProgressModel.findAll.mockResolvedValue(['tree-x']);
  EquipmentModel.findAll.mockResolvedValue(['equip-x']);
  NephilimBreakthroughModel.findAll.mockResolvedValue(['neph-x']);
  ManeuverModel.findAll.mockResolvedValue(['maneuver-x']);
  AbilityModel.findAll.mockResolvedValue(['ability-x']);
  RitualTrackerModel.findAll.mockResolvedValue(['ritual-x']);
  CharacterModel.findOwnerUsername.mockResolvedValue('ownerName');
}

beforeEach(() => jest.clearAllMocks());

describe('CharacterController.list', () => {
  it('lists characters for the authenticated user', async () => {
    CharacterModel.findAllByUser.mockResolvedValue([{ id: 'c1' }]);
    const req = mockReq({ user: { sub: 'u1' } });
    const res = mockRes();

    await CharacterController.list(req, res);

    expect(CharacterModel.findAllByUser).toHaveBeenCalledWith('u1');
    expect(res.json).toHaveBeenCalledWith({ characters: [{ id: 'c1' }] });
  });
});

describe('CharacterController.create', () => {
  it.each([
    ['name', { archetype: 'fighter', race: 'human' }],
    ['archetype', { name: 'Bob', race: 'human' }],
    ['race', { name: 'Bob', archetype: 'fighter' }],
  ])('400s when %s is missing', async (_field, body) => {
    const req = mockReq({ body });
    const res = mockRes();

    await CharacterController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(CharacterModel.create).not.toHaveBeenCalled();
  });

  it('creates the character and returns 201', async () => {
    const body = { name: 'Bob', archetype: 'fighter', race: 'human', race_ancestry: null, skills: { evasion: 3 } };
    CharacterModel.create.mockResolvedValue({ id: 'c1', ...body });
    const req = mockReq({ body, user: { sub: 'u1' } });
    const res = mockRes();

    await CharacterController.create(req, res);

    expect(CharacterModel.create).toHaveBeenCalledWith('u1', {
      name: 'Bob', archetype: 'fighter', race: 'human', race_ancestry: null, skills: { evasion: 3 },
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ character: { id: 'c1', ...body } });
  });
});

describe('CharacterController.getSheet', () => {
  it('404s when the character does not exist', async () => {
    CharacterModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await CharacterController.getSheet(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('403s when requester is not owner, not GM, not campaign GM, and sheet is private', async () => {
    CharacterModel.findById.mockResolvedValue({ id: 'c1', user_id: 'owner-1', is_public: false });
    isCampaignGmForCharacter.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'stranger', role: 'player' } });
    const res = mockRes();

    await CharacterController.getSheet(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(SkillModel.findAll).not.toHaveBeenCalled();
  });

  it('allows the owner and marks is_owner true', async () => {
    CharacterModel.findById.mockResolvedValue({ id: 'c1', user_id: 'owner-1', is_public: false });
    mockAggregationModels();
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'owner-1', role: 'player' } });
    const res = mockRes();

    await CharacterController.getSheet(req, res);

    expect(res.status).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.is_owner).toBe(true);
    expect(payload.character).toEqual({ id: 'c1', user_id: 'owner-1', is_public: false, owner_username: 'ownerName' });
    expect(payload.skills).toEqual(['skill-x']);
    expect(payload.spells).toEqual(['spell-x']);
    expect(payload.tree).toEqual(['tree-x']);
    expect(payload.equipment).toEqual(['equip-x']);
    expect(payload.nephilim_breakthroughs).toEqual(['neph-x']);
    expect(payload.maneuvers).toEqual(['maneuver-x']);
    expect(payload.abilities).toEqual(['ability-x']);
    expect(payload.rituals).toEqual(['ritual-x']);
  });

  it('allows a global game_master role even when private and not campaign GM, but keeps is_owner false', async () => {
    CharacterModel.findById.mockResolvedValue({ id: 'c1', user_id: 'owner-1', is_public: false });
    isCampaignGmForCharacter.mockResolvedValue(false);
    mockAggregationModels();
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'gm-user', role: 'game_master' } });
    const res = mockRes();

    await CharacterController.getSheet(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].is_owner).toBe(false);
  });

  it('allows a campaign GM and marks is_owner true', async () => {
    CharacterModel.findById.mockResolvedValue({ id: 'c1', user_id: 'owner-1', is_public: false });
    isCampaignGmForCharacter.mockResolvedValue(true);
    mockAggregationModels();
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'campaign-gm', role: 'player' } });
    const res = mockRes();

    await CharacterController.getSheet(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].is_owner).toBe(true);
    expect(isCampaignGmForCharacter).toHaveBeenCalledWith('c1', 'campaign-gm');
  });

  it('allows any authenticated viewer when the sheet is public, but keeps is_owner false', async () => {
    CharacterModel.findById.mockResolvedValue({ id: 'c1', user_id: 'owner-1', is_public: true });
    isCampaignGmForCharacter.mockResolvedValue(false);
    mockAggregationModels();
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'stranger', role: 'player' } });
    const res = mockRes();

    await CharacterController.getSheet(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].is_owner).toBe(false);
  });
});

describe('CharacterController.getPublicSheet', () => {
  it('404s when there is no public character with that id', async () => {
    CharacterModel.findPublicById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CharacterController.getPublicSheet(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns the reduced payload (no tree, no nephilim_breakthroughs) with is_owner always false', async () => {
    CharacterModel.findPublicById.mockResolvedValue({ id: 'c1', user_id: 'owner-1', is_public: true });
    mockAggregationModels();
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CharacterController.getPublicSheet(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.character).toEqual({ id: 'c1', user_id: 'owner-1', is_public: true, owner_username: 'ownerName' });
    expect(payload.skills).toEqual(['skill-x']);
    expect(payload.spells).toEqual(['spell-x']);
    expect(payload.equipment).toEqual(['equip-x']);
    expect(payload.maneuvers).toEqual(['maneuver-x']);
    expect(payload.abilities).toEqual(['ability-x']);
    expect(payload.rituals).toEqual(['ritual-x']);
    expect(payload.tree).toBeUndefined();
    expect(payload.nephilim_breakthroughs).toBeUndefined();
    expect(payload.is_owner).toBe(false);
  });
});

describe('CharacterController.update', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CharacterController.update(req, res);

    expect(CharacterModel.update).not.toHaveBeenCalled();
  });

  it('updates and returns the character when authorized', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    CharacterModel.update.mockResolvedValue({ id: 'c1', name: 'New' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'New' } });
    const res = mockRes();

    await CharacterController.update(req, res);

    expect(CharacterModel.update).toHaveBeenCalledWith('c1', { name: 'New' });
    expect(res.json).toHaveBeenCalledWith({ character: { id: 'c1', name: 'New' } });
  });
});

describe('CharacterController.remove', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CharacterController.remove(req, res);

    expect(CharacterModel.delete).not.toHaveBeenCalled();
  });

  it('404s when the model reports nothing was deleted', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    CharacterModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CharacterController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deletes and confirms when authorized', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    CharacterModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await CharacterController.remove(req, res);

    expect(CharacterModel.delete).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
