jest.mock('../../config/db');

const pool = require('../../config/db');
const CampaignModel = require('../campaign.model');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CampaignModel.create', () => {
  it('inserts with a generated invite_code and returns the created row', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1', gm_id: 'gm1', name: 'My Campaign' }] });

    const campaign = await CampaignModel.create('gm1', 'My Campaign');

    expect(campaign).toEqual({ id: 'c1', gm_id: 'gm1', name: 'My Campaign' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO campaigns\.campaigns/);
    expect(params[0]).toBe('gm1');
    expect(params[1]).toBe('My Campaign');
    expect(typeof params[2]).toBe('string');
    expect(params[2].length).toBeGreaterThan(0);
  });

  it('retries with a fresh invite_code on a unique-violation', async () => {
    const conflict = Object.assign(new Error('duplicate'), { code: '23505' });
    pool.query
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce({ rows: [{ id: 'c1' }] });

    const campaign = await CampaignModel.create('gm1', 'My Campaign');

    expect(campaign).toEqual({ id: 'c1' });
    expect(pool.query).toHaveBeenCalledTimes(2);
    const firstCode = pool.query.mock.calls[0][1][2];
    const secondCode = pool.query.mock.calls[1][1][2];
    expect(firstCode).not.toBe(secondCode);
  });

  it('rethrows non-conflict errors immediately', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));
    await expect(CampaignModel.create('gm1', 'My Campaign')).rejects.toThrow('boom');
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe('CampaignModel reads', () => {
  it('findById joins auth.users for the GM username', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1', gm_id: 'gm1', gm_username: 'bob' }] });
    const campaign = await CampaignModel.findById('c1');
    expect(campaign).toEqual({ id: 'c1', gm_id: 'gm1', gm_username: 'bob' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/JOIN auth\.users u ON u\.id = cp\.gm_id/);
    expect(params).toEqual(['c1']);
  });

  it('findById returns null when not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CampaignModel.findById('missing')).toBeNull();
  });

  it('findByInviteCode queries by invite_code', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    const campaign = await CampaignModel.findByInviteCode('ABC123');
    expect(campaign).toEqual({ id: 'c1' });
    expect(pool.query.mock.calls[0][1]).toEqual(['ABC123']);
  });

  it('findByInviteCode returns null when not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CampaignModel.findByInviteCode('NOPE')).toBeNull();
  });

  it('findAllForUser joins campaign_characters/characters to include GM and player-joined campaigns', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1', is_gm: true }] });
    const rows = await CampaignModel.findAllForUser('u1');
    expect(rows).toEqual([{ id: 'c1', is_gm: true }]);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LEFT JOIN campaigns\.campaign_characters cc/);
    expect(sql).toMatch(/LEFT JOIN character_sheet\.characters c/);
    expect(sql).toMatch(/WHERE cp\.gm_id = \$1 OR c\.user_id = \$1/);
    expect(params).toEqual(['u1']);
  });

  it('findCharacterOwner queries character_sheet.characters directly (cross-schema)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'ch1', user_id: 'u1' }] });
    const character = await CampaignModel.findCharacterOwner('ch1');
    expect(character).toEqual({ id: 'ch1', user_id: 'u1' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM character_sheet\.characters/);
    expect(params).toEqual(['ch1']);
  });
});

describe('CampaignModel.findCompendiumEntry', () => {
  it('queries compendium.compendium_entries directly (cross-schema), joins health_die, selects entity_type/rolled_health, scoped by own-or-public unless admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'e1', name: 'Goblin', entity_type: 'npc', body: 3, dexterity: 4, health_die: 'd8', rolled_health: 12 }] });
    const entry = await CampaignModel.findCompendiumEntry('e1', 'u1', false);
    expect(entry).toEqual({ id: 'e1', name: 'Goblin', entity_type: 'npc', body: 3, dexterity: 4, health_die: 'd8', rolled_health: 12 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM compendium\.compendium_entries e/);
    expect(sql).toMatch(/e\.entity_type/);
    expect(sql).toMatch(/e\.rolled_health/);
    expect(sql).toMatch(/LEFT JOIN compendium\.species sp ON sp\.id = e\.species_id/);
    expect(sql).toMatch(/LEFT JOIN compendium\.subspecies sub ON sub\.id = e\.subspecies_id/);
    expect(sql).toMatch(/COALESCE\(sub\.health_die, sp\.health_die, 'd6'\) AS health_die/);
    expect(sql).toMatch(/\$3::bool OR e\.created_by = \$2 OR e\.is_public = true/);
    expect(params).toEqual(['e1', 'u1', false]);
  });

  it('returns null when the entry is missing or not visible to this user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CampaignModel.findCompendiumEntry('e1', 'u1', false)).toBeNull();
  });
});

describe('CampaignModel notes updates', () => {
  it('updateSharedNotes updates shared_notes only', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1', shared_notes: 'hi' }] });
    const updated = await CampaignModel.updateSharedNotes('c1', 'hi');
    expect(updated).toEqual({ id: 'c1', shared_notes: 'hi' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/SET shared_notes = \$2/);
    expect(params).toEqual(['c1', 'hi']);
  });

  it('updateGmNotes updates gm_notes only', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1', gm_notes: 'secret' }] });
    const updated = await CampaignModel.updateGmNotes('c1', 'secret');
    expect(updated).toEqual({ id: 'c1', gm_notes: 'secret' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/SET gm_notes = \$2/);
    expect(params).toEqual(['c1', 'secret']);
  });

  it('updateDescription updates description only', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1', description: 'A tale of...' }] });
    const updated = await CampaignModel.updateDescription('c1', 'A tale of...');
    expect(updated).toEqual({ id: 'c1', description: 'A tale of...' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/SET description = \$2/);
    expect(params).toEqual(['c1', 'A tale of...']);
  });

  it('rename updates name only', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1', name: 'New Name' }] });
    const updated = await CampaignModel.rename('c1', 'New Name');
    expect(updated).toEqual({ id: 'c1', name: 'New Name' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/SET name = \$2/);
    expect(params).toEqual(['c1', 'New Name']);
  });
});

describe('CampaignModel.updateCurrentDate', () => {
  it('updates calendar_id and current date fields together', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1', calendar_id: 'cal-1', current_year: 100 }] });
    const updated = await CampaignModel.updateCurrentDate('c1', {
      calendar_id: 'cal-1', current_year: 100, current_month_id: 'm1', current_day: 5,
    });
    expect(updated).toEqual({ id: 'c1', calendar_id: 'cal-1', current_year: 100 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/SET calendar_id = \$2, current_year = \$3, current_month_id = \$4, current_day = \$5/);
    expect(params).toEqual(['c1', 'cal-1', 100, 'm1', 5]);
  });

  it('defaults every field to null when omitted (clearing the tracked date)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await CampaignModel.updateCurrentDate('c1', {});
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['c1', null, null, null, null]);
  });

  it('returns null when the campaign does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CampaignModel.updateCurrentDate('missing', {})).toBeNull();
  });
});

describe('CampaignModel.remove', () => {
  it('deletes the campaign and returns true when a row was removed', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await CampaignModel.remove('c1')).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM campaigns\.campaigns WHERE id = \$1/);
    expect(params).toEqual(['c1']);
  });

  it('returns false when no matching campaign existed', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await CampaignModel.remove('c1')).toBe(false);
  });
});
