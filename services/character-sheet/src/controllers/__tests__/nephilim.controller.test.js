jest.mock('../../models/character.model');
jest.mock('../../models/nephilim-breakthrough.model');
jest.mock('../../models/campaign-access.model');
jest.mock('../authorize-character-write');

const CharacterModel = require('../../models/character.model');
const NephilimBreakthroughModel = require('../../models/nephilim-breakthrough.model');
const { isCampaignGmForCharacter } = require('../../models/campaign-access.model');
const authorizeCharacterWrite = require('../authorize-character-write');
const { calcAllowedBreakthroughs } = require('../../rules/nephilim.rules');
const NephilimController = require('../nephilim.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq(overrides = {}) {
  return { params: {}, body: {}, user: { sub: 'user-1' }, ...overrides };
}

beforeEach(() => jest.clearAllMocks());

describe('NephilimController.list', () => {
  it('404s when the character does not exist', async () => {
    CharacterModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await NephilimController.list(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('allows the owner', async () => {
    CharacterModel.findById.mockResolvedValue({ id: 'c1', user_id: 'owner-1', is_public: false });
    NephilimBreakthroughModel.findAll.mockResolvedValue(['n1']);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'owner-1', role: 'player' } });
    const res = mockRes();

    await NephilimController.list(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ breakthroughs: ['n1'] });
  });

  it('403s when requester is not owner, not GM, not campaign GM, and sheet is private', async () => {
    CharacterModel.findById.mockResolvedValue({ id: 'c1', user_id: 'owner-1', is_public: false });
    isCampaignGmForCharacter.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'stranger', role: 'player' } });
    const res = mockRes();

    await NephilimController.list(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(NephilimBreakthroughModel.findAll).not.toHaveBeenCalled();
  });
});

describe('NephilimController.use', () => {
  it('stops without further calls when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', nodeId: 'n1' } });
    const res = mockRes();

    await NephilimController.use(req, res);

    expect(NephilimBreakthroughModel.countUnlocked).not.toHaveBeenCalled();
    expect(NephilimBreakthroughModel.use).not.toHaveBeenCalled();
  });

  it('400s when no breakthroughs remain allowed for the unlocked node count', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    NephilimBreakthroughModel.countUnlocked.mockResolvedValue(0);
    NephilimBreakthroughModel.findAll.mockResolvedValue([]); // 0 used
    // calcAllowedBreakthroughs(0) === 0, so 0 used >= 0 allowed -> blocked
    expect(calcAllowedBreakthroughs(0)).toBe(0);
    const req = mockReq({ params: { id: 'c1', nodeId: 'n1' } });
    const res = mockRes();

    await NephilimController.use(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(NephilimBreakthroughModel.use).not.toHaveBeenCalled();
  });

  it('is idempotent: returns 200 (not 201) when the node was already used', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    const unlockedCount = 100; // comfortably yields totalAllowed > 0
    const totalAllowed = calcAllowedBreakthroughs(unlockedCount);
    expect(totalAllowed).toBeGreaterThan(0);
    NephilimBreakthroughModel.countUnlocked.mockResolvedValue(unlockedCount);
    NephilimBreakthroughModel.findAll.mockResolvedValue([]); // used count under the cap
    NephilimBreakthroughModel.use.mockResolvedValue(null); // ON CONFLICT DO NOTHING -> already used
    const req = mockReq({ params: { id: 'c1', nodeId: 'n1' } });
    const res = mockRes();

    await NephilimController.use(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Прорив вже використано для цього вузла' });
  });

  it('201s with the node_id on a fresh breakthrough', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    const unlockedCount = 100;
    expect(calcAllowedBreakthroughs(unlockedCount)).toBeGreaterThan(0);
    NephilimBreakthroughModel.countUnlocked.mockResolvedValue(unlockedCount);
    NephilimBreakthroughModel.findAll.mockResolvedValue([]);
    NephilimBreakthroughModel.use.mockResolvedValue('n1');
    const req = mockReq({ params: { id: 'c1', nodeId: 'n1' } });
    const res = mockRes();

    await NephilimController.use(req, res);

    expect(NephilimBreakthroughModel.use).toHaveBeenCalledWith('c1', 'n1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ node_id: 'n1' });
  });
});

describe('NephilimController.revoke', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', nodeId: 'n1' } });
    const res = mockRes();

    await NephilimController.revoke(req, res);

    expect(NephilimBreakthroughModel.revoke).not.toHaveBeenCalled();
  });

  it('404s when nothing was revoked', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    NephilimBreakthroughModel.revoke.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', nodeId: 'n1' } });
    const res = mockRes();

    await NephilimController.revoke(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('confirms revocation on success', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    NephilimBreakthroughModel.revoke.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', nodeId: 'n1' } });
    const res = mockRes();

    await NephilimController.revoke(req, res);

    expect(NephilimBreakthroughModel.revoke).toHaveBeenCalledWith('c1', 'n1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Прорив скасовано' });
  });
});
