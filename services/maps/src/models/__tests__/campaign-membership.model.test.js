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

describe('CampaignMembershipModel.memberCampaignIdsForMap', () => {
  it('queries campaign_maps joined to campaigns/character_sheet for GM-or-character-owner campaigns linked to this map', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ campaign_id: 'camp-1' }, { campaign_id: 'camp-2' }] });
    await expect(CampaignMembershipModel.memberCampaignIdsForMap('map-1', 'u1')).resolves.toEqual(['camp-1', 'camp-2']);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM campaigns\.campaign_maps cm/);
    expect(sql).toMatch(/JOIN campaigns\.campaigns cp ON cp\.id = cm\.campaign_id/);
    expect(sql).toMatch(/LEFT JOIN campaigns\.campaign_characters cc/);
    expect(sql).toMatch(/LEFT JOIN character_sheet\.characters c/);
    expect(sql).toMatch(/cm\.map_id = \$1 AND \(cp\.gm_id = \$2 OR c\.user_id = \$2\)/);
    expect(params).toEqual(['map-1', 'u1']);
  });

  it('returns an empty array when the map has no campaigns the user belongs to', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await expect(CampaignMembershipModel.memberCampaignIdsForMap('map-1', 'stranger')).resolves.toEqual([]);
  });
});
