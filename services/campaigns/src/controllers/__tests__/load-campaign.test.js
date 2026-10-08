jest.mock('../../models/campaign.model');
jest.mock('../../models/campaign-character.model');

const CampaignModel = require('../../models/campaign.model');
const CampaignCharacterModel = require('../../models/campaign-character.model');
const { loadCampaignOr404, canManage, canView, accessOf } = require('../load-campaign');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ params = { id: 'campaign-1' } } = {}) {
  return { params };
}

beforeEach(() => jest.clearAllMocks());

describe('loadCampaignOr404', () => {
  it('responds 404 and resolves null when the campaign does not exist', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq();
    const res = mockRes();

    const result = await loadCampaignOr404(req, res);

    expect(CampaignModel.findById).toHaveBeenCalledWith('campaign-1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: expect.any(String) });
    expect(result).toBeNull();
  });

  it('resolves the campaign without touching res when found', async () => {
    const campaign = { id: 'campaign-1', gm_id: 'gm-1' };
    CampaignModel.findById.mockResolvedValue(campaign);
    const req = mockReq();
    const res = mockRes();

    const result = await loadCampaignOr404(req, res);

    expect(result).toBe(campaign);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('canManage', () => {
  it('is true for the campaign GM', () => {
    expect(canManage({ gm_id: 'user-1' }, { sub: 'user-1', role: 'user' })).toBe(true);
  });

  it('is true for an admin in any campaign', () => {
    expect(canManage({ gm_id: 'user-1' }, { sub: 'admin-1', role: 'admin' })).toBe(true);
  });

  it('is false for anyone else, including other game masters', () => {
    expect(canManage({ gm_id: 'user-1' }, { sub: 'user-2', role: 'game_master' })).toBe(false);
  });
});

describe('canView', () => {
  it('lets a manager in without a membership lookup', async () => {
    await expect(canView({ id: 'c1', gm_id: 'u1' }, { sub: 'u1' })).resolves.toBe(true);
    expect(CampaignCharacterModel.isMember).not.toHaveBeenCalled();
  });

  it('falls back to character membership', async () => {
    CampaignCharacterModel.isMember.mockResolvedValue(false);
    await expect(canView({ id: 'c1', gm_id: 'u1' }, { sub: 'u2' })).resolves.toBe(false);
    expect(CampaignCharacterModel.isMember).toHaveBeenCalledWith('c1', 'u2');
  });
});

describe('accessOf', () => {
  it('distinguishes gm, admin and player', () => {
    const campaign = { gm_id: 'gm-1' };
    expect(accessOf(campaign, { sub: 'gm-1', role: 'admin' })).toBe('gm');
    expect(accessOf(campaign, { sub: 'a1', role: 'admin' })).toBe('admin');
    expect(accessOf(campaign, { sub: 'p1', role: 'user' })).toBe('player');
  });
});
