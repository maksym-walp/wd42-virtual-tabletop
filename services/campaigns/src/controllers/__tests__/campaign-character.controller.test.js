jest.mock('../../models/campaign.model');
jest.mock('../../models/campaign-character.model');

const CampaignModel = require('../../models/campaign.model');
const CampaignCharacterModel = require('../../models/campaign-character.model');
const CampaignCharacterController = require('../campaign-character.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}

function mockReq({ body = {}, params = {}, user = { sub: 'user-1' } } = {}) {
  return { body, params, user };
}

beforeEach(() => jest.clearAllMocks());

describe('CampaignCharacterController.join', () => {
  it('returns 400 when invite_code or character_id is missing', async () => {
    const req = mockReq({ body: { invite_code: 'ABC123' } });
    const res = mockRes();
    await CampaignCharacterController.join(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(CampaignModel.findByInviteCode).not.toHaveBeenCalled();
  });

  it('returns 404 when the invite code does not match a campaign', async () => {
    CampaignModel.findByInviteCode.mockResolvedValue(null);
    const req = mockReq({ body: { invite_code: 'NOPE', character_id: 'ch-1' } });
    const res = mockRes();
    await CampaignCharacterController.join(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 404 when the character does not exist', async () => {
    CampaignModel.findByInviteCode.mockResolvedValue({ id: 'c1' });
    CampaignModel.findCharacterOwner.mockResolvedValue(null);
    const req = mockReq({ body: { invite_code: 'ABC123', character_id: 'ch-1' } });
    const res = mockRes();
    await CampaignCharacterController.join(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when the character belongs to someone else', async () => {
    CampaignModel.findByInviteCode.mockResolvedValue({ id: 'c1' });
    CampaignModel.findCharacterOwner.mockResolvedValue({ id: 'ch-1', user_id: 'other-user' });
    const req = mockReq({ body: { invite_code: 'ABC123', character_id: 'ch-1' }, user: { sub: 'user-1' } });
    const res = mockRes();
    await CampaignCharacterController.join(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CampaignCharacterModel.add).not.toHaveBeenCalled();
  });

  it('responds 200 (idempotent) when the character is already joined', async () => {
    const campaign = { id: 'c1' };
    CampaignModel.findByInviteCode.mockResolvedValue(campaign);
    CampaignModel.findCharacterOwner.mockResolvedValue({ id: 'ch-1', user_id: 'user-1' });
    CampaignCharacterModel.add.mockResolvedValue(null);
    const req = mockReq({ body: { invite_code: 'ABC123', character_id: 'ch-1' }, user: { sub: 'user-1' } });
    const res = mockRes();

    await CampaignCharacterController.join(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: expect.any(String), campaign });
  });

  it('responds 201 when the character is newly joined', async () => {
    const campaign = { id: 'c1' };
    CampaignModel.findByInviteCode.mockResolvedValue(campaign);
    CampaignModel.findCharacterOwner.mockResolvedValue({ id: 'ch-1', user_id: 'user-1' });
    CampaignCharacterModel.add.mockResolvedValue({ id: 'link-1' });
    const req = mockReq({ body: { invite_code: 'ABC123', character_id: 'ch-1' }, user: { sub: 'user-1' } });
    const res = mockRes();

    await CampaignCharacterController.join(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ campaign, character_id: 'ch-1' });
  });

  it('rethrows unexpected model errors', async () => {
    const err = new Error('db down');
    CampaignModel.findByInviteCode.mockRejectedValue(err);
    const req = mockReq({ body: { invite_code: 'ABC123', character_id: 'ch-1' } });
    const res = mockRes();
    await expect(CampaignCharacterController.join(req, res)).rejects.toBe(err);
  });
});

describe('CampaignCharacterController.addByGm', () => {
  it('returns 404 when campaign is missing', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();
    await CampaignCharacterController.addByGm(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CampaignCharacterController.addByGm(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when character_id is missing', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1' }, body: {}, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CampaignCharacterController.addByGm(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when the character does not exist', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignModel.findCharacterOwner.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { character_id: 'ch-1' }, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CampaignCharacterController.addByGm(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('responds 200 (idempotent) when already joined', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignModel.findCharacterOwner.mockResolvedValue({ id: 'ch-1', user_id: 'player-1' });
    CampaignCharacterModel.add.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { character_id: 'ch-1' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignCharacterController.addByGm(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('responds 201 when newly attached', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignModel.findCharacterOwner.mockResolvedValue({ id: 'ch-1', user_id: 'player-1' });
    CampaignCharacterModel.add.mockResolvedValue({ id: 'link-1' });
    const req = mockReq({ params: { id: 'c1' }, body: { character_id: 'ch-1' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignCharacterController.addByGm(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ character_id: 'ch-1' });
  });
});

describe('CampaignCharacterController.list', () => {
  it('returns 404 when campaign is missing', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();
    await CampaignCharacterController.list(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when requester is neither GM nor member', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignCharacterModel.isMember.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'stranger' } });
    const res = mockRes();
    await CampaignCharacterController.list(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('marks is_mine correctly per character for the requester', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignCharacterModel.isMember.mockResolvedValue(true);
    CampaignCharacterModel.listWithOwners.mockResolvedValue([
      { character_id: 'ch-1', owner_id: 'user-1' },
      { character_id: 'ch-2', owner_id: 'other-user' },
    ]);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'user-1' } });
    const res = mockRes();

    await CampaignCharacterController.list(req, res);

    expect(res.json).toHaveBeenCalledWith({
      characters: [
        { character_id: 'ch-1', owner_id: 'user-1', is_mine: true },
        { character_id: 'ch-2', owner_id: 'other-user', is_mine: false },
      ],
    });
  });

  it('does not call isMember for the GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignCharacterModel.listWithOwners.mockResolvedValue([]);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignCharacterController.list(req, res);

    expect(CampaignCharacterModel.isMember).not.toHaveBeenCalled();
  });
});

describe('CampaignCharacterController.remove', () => {
  it('returns 404 when campaign is missing', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing', characterId: 'ch-1' } });
    const res = mockRes();
    await CampaignCharacterController.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1', characterId: 'ch-1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CampaignCharacterController.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CampaignCharacterModel.remove).not.toHaveBeenCalled();
  });

  it('removes the character link and responds 204', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignCharacterModel.remove.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', characterId: 'ch-1' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignCharacterController.remove(req, res);

    expect(CampaignCharacterModel.remove).toHaveBeenCalledWith('c1', 'ch-1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});
