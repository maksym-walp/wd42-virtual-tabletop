jest.mock('../../models/character.model');
jest.mock('../../models/skill.model');
jest.mock('../../models/campaign-access.model');
jest.mock('../authorize-character-write');

const CharacterModel = require('../../models/character.model');
const SkillModel = require('../../models/skill.model');
const { isCampaignGmForCharacter } = require('../../models/campaign-access.model');
const authorizeCharacterWrite = require('../authorize-character-write');
const SkillController = require('../skill.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq(overrides = {}) {
  return { params: {}, body: {}, user: { sub: 'user-1' }, ...overrides };
}

beforeEach(() => jest.clearAllMocks());

describe('SkillController.getAll', () => {
  it('404s when the character does not exist', async () => {
    CharacterModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await SkillController.getAll(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('allows the owner', async () => {
    CharacterModel.findById.mockResolvedValue({ id: 'c1', user_id: 'owner-1', is_public: false });
    SkillModel.findAll.mockResolvedValue([{ skill_key: 'evasion' }]);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'owner-1', role: 'player' } });
    const res = mockRes();

    await SkillController.getAll(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ skills: [{ skill_key: 'evasion' }] });
  });

  it('403s when requester is not owner, not GM, not campaign GM, and sheet is private', async () => {
    CharacterModel.findById.mockResolvedValue({ id: 'c1', user_id: 'owner-1', is_public: false });
    isCampaignGmForCharacter.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'stranger', role: 'player' } });
    const res = mockRes();

    await SkillController.getAll(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(SkillModel.findAll).not.toHaveBeenCalled();
  });
});

describe('SkillController.patch', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', key: 'evasion' }, body: { value: 5 } });
    const res = mockRes();

    await SkillController.patch(req, res);

    expect(SkillModel.patch).not.toHaveBeenCalled();
  });

  it('404s when the skill is not found', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    SkillModel.patch.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', key: 'evasion' }, body: { value: 5 } });
    const res = mockRes();

    await SkillController.patch(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('patches and returns the skill on success', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    SkillModel.patch.mockResolvedValue({ skill_key: 'evasion', value: 5, progress_marks: 2 });
    const req = mockReq({ params: { id: 'c1', key: 'evasion' }, body: { value: 5, progress_marks: 2 } });
    const res = mockRes();

    await SkillController.patch(req, res);

    expect(SkillModel.patch).toHaveBeenCalledWith('c1', 'evasion', { value: 5, progress_marks: 2 });
    expect(res.json).toHaveBeenCalledWith({ skill: { skill_key: 'evasion', value: 5, progress_marks: 2 } });
  });
});

describe('SkillController.bulkUpdate', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { updates: [] } });
    const res = mockRes();

    await SkillController.bulkUpdate(req, res);

    expect(SkillModel.bulkUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ['an object', { evasion: 5 }],
    ['a string', 'not-an-array'],
  ])('400s when updates is %s instead of an array', async (_label, updates) => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: { updates } });
    const res = mockRes();

    await SkillController.bulkUpdate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(SkillModel.bulkUpdate).not.toHaveBeenCalled();
  });

  it('bulk-updates and returns the skills on success', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    const updates = [{ skill_key: 'evasion', value: 5 }];
    SkillModel.bulkUpdate.mockResolvedValue([{ skill_key: 'evasion', value: 5 }]);
    const req = mockReq({ params: { id: 'c1' }, body: { updates } });
    const res = mockRes();

    await SkillController.bulkUpdate(req, res);

    expect(SkillModel.bulkUpdate).toHaveBeenCalledWith('c1', updates);
    expect(res.json).toHaveBeenCalledWith({ skills: [{ skill_key: 'evasion', value: 5 }] });
  });
});
