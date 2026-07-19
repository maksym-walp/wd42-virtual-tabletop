jest.mock('../../models/campaign.model');

const CampaignModel = require('../../models/campaign.model');
const { loadCampaignOr404, isGm } = require('../load-campaign');

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

describe('isGm', () => {
  it('returns true when campaign.gm_id matches the user id', () => {
    expect(isGm({ gm_id: 'user-1' }, 'user-1')).toBe(true);
  });

  it('returns false when campaign.gm_id does not match the user id', () => {
    expect(isGm({ gm_id: 'user-1' }, 'user-2')).toBe(false);
  });
});
