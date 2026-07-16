jest.mock('../../config/db');

const pool = require('../../config/db');
const { isCampaignGmForCharacter } = require('../campaign-access.model');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isCampaignGmForCharacter', () => {
  it('joins campaign_characters and campaigns, filtering by character_id and gm_id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const result = await isCampaignGmForCharacter('ch1', 'gm1');

    expect(result).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM campaigns\.campaign_characters cc/);
    expect(sql).toMatch(/JOIN campaigns\.campaigns cp ON cp\.id = cc\.campaign_id/);
    expect(sql).toMatch(/cc\.character_id = \$1/);
    expect(sql).toMatch(/cp\.gm_id = \$2/);
    expect(params).toEqual(['ch1', 'gm1']);
  });

  it('returns false when no matching row exists', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await isCampaignGmForCharacter('ch1', 'someone-else')).toBe(false);
  });
});
