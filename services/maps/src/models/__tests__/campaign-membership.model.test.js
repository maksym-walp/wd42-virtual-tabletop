jest.mock('../../config/db');

const pool = require('../../config/db');
const CampaignMembershipModel = require('../campaign-membership.model');

beforeEach(() => jest.clearAllMocks());

describe('CampaignMembershipModel.isMember', () => {
  it('queries campaigns/character_sheet cross-schema for GM-or-character-owner', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    await expect(CampaignMembershipModel.isMember('camp-1', 'u1')).resolves.toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM campaigns\.campaigns cp/);
    expect(sql).toMatch(/LEFT JOIN campaigns\.campaign_characters cc/);
    expect(sql).toMatch(/LEFT JOIN character_sheet\.characters c/);
    expect(sql).toMatch(/cp\.gm_id = \$2 OR c\.user_id = \$2/);
    expect(params).toEqual(['camp-1', 'u1']);
  });

  it('returns false when the user is neither the GM nor a character owner', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await expect(CampaignMembershipModel.isMember('camp-1', 'stranger')).resolves.toBe(false);
  });
});
