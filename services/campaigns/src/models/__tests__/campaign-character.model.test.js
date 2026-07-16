jest.mock('../../config/db');

const pool = require('../../config/db');
const CampaignCharacterModel = require('../campaign-character.model');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CampaignCharacterModel.add', () => {
  it('inserts the campaign/character pair and returns the row', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ campaign_id: 'c1', character_id: 'ch1' }] });
    const added = await CampaignCharacterModel.add('c1', 'ch1');
    expect(added).toEqual({ campaign_id: 'c1', character_id: 'ch1' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ON CONFLICT \(campaign_id, character_id\) DO NOTHING/);
    expect(params).toEqual(['c1', 'ch1']);
  });

  it('returns null when the character is already attached (conflict, no row returned)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CampaignCharacterModel.add('c1', 'ch1')).toBeNull();
  });
});

describe('CampaignCharacterModel.listWithOwners', () => {
  it('joins across campaign_characters, character_sheet.characters and auth.users', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ character_id: 'ch1', owner_username: 'bob', owner_email: 'bob@example.com' }],
    });
    const rows = await CampaignCharacterModel.listWithOwners('c1');
    expect(rows).toHaveLength(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM campaigns\.campaign_characters cc/);
    expect(sql).toMatch(/JOIN character_sheet\.characters c ON c\.id = cc\.character_id/);
    expect(sql).toMatch(/JOIN auth\.users u ON u\.id = c\.user_id/);
    expect(params).toEqual(['c1']);
  });
});

describe('CampaignCharacterModel.isMember', () => {
  it('returns true when the user owns a character attached to the campaign', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    expect(await CampaignCharacterModel.isMember('c1', 'u1')).toBe(true);
  });

  it('returns false when no matching row exists', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CampaignCharacterModel.isMember('c1', 'u1')).toBe(false);
  });
});
