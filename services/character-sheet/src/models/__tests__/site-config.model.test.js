jest.mock('../../config/db');

const pool = require('../../config/db');
const SiteConfigModel = require('../site-config.model');

beforeEach(() => jest.clearAllMocks());

const R1 = 'r1';
const bonus = [{ skill: 'strength', value: 1 }];
const raceConfig = (extra = {}) => ({
  rows: [{
    value: [{
      race_id: R1, bonus_characteristic: 'agility', bonus_budget: 0,
      peoples: [{ people_id: 'p1', skill_bonuses: [...bonus, { skill: 'strength', value: 1 }, { skill: 'will', value: 2 }] }],
      ...extra,
    }],
  }],
});

describe('SiteConfigModel.getCharacterConfig', () => {
  it('maps admin.site_configs rows to { conditions, currencies, races }', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { key: 'conditions', value: [{ key: 'exhaustion', label: 'Втома' }] },
        { key: 'currencies', value: [{ key: 'arbor', label: 'Арбор' }] },
      ],
    });

    await expect(SiteConfigModel.getCharacterConfig()).resolves.toEqual({
      conditions: [{ key: 'exhaustion', label: 'Втома' }],
      currencies: [{ key: 'arbor', label: 'Арбор' }],
      races: [],
    });
    expect(pool.query.mock.calls[0][0]).toMatch(/key IN \('conditions', 'currencies', 'character_races'\)/);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('falls back to empty arrays when nothing is seeded', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await expect(SiteConfigModel.getCharacterConfig()).resolves.toEqual({ conditions: [], currencies: [], races: [] });
  });

  it('joins configured races and peoples with public compendium entries and drops the rest', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{
          key: 'character_races',
          value: [
            {
              race_id: 'r1', bonus_characteristic: 'agility', bonus_budget: 0,
              peoples: [
                { people_id: 'p1', skill_bonuses: bonus },
                { people_id: 'p-private', skill_bonuses: [] },
              ],
            },
            { race_id: 'r-private', peoples: [{ people_id: 'p1' }] },
          ],
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'r1', name: 'Люди', description: '<p>Опис</p>', image_url: '/u/h.png' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'p1', name: 'Північні', description: 'Опис народу' }] });

    const { races } = await SiteConfigModel.getCharacterConfig();

    expect(races).toEqual([{
      id: 'r1', name: 'Люди', description: '<p>Опис</p>', image_url: '/u/h.png',
      bonus_characteristic: 'agility', bonus_budget: 0,
      peoples: [{ id: 'p1', name: 'Північні', description: 'Опис народу', skill_bonuses: bonus }],
    }]);
    expect(pool.query.mock.calls[1][0]).toMatch(/compendium\.races .*is_public = true/);
    expect(pool.query.mock.calls[2][0]).toMatch(/compendium\.peoples .*is_public = true/);
  });
});

describe('SiteConfigModel.isCharacterRace', () => {
  it('is true for a configured, still-public race', async () => {
    pool.query.mockResolvedValueOnce(raceConfig()).mockResolvedValueOnce({ rows: [{ id: R1, name: 'Люди' }] });
    await expect(SiteConfigModel.isCharacterRace(R1)).resolves.toBe(true);
  });

  it('is false for a race the admin has not opened, without hitting the compendium', async () => {
    pool.query.mockResolvedValueOnce(raceConfig());
    await expect(SiteConfigModel.isCharacterRace('other')).resolves.toBe(false);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('is false when the race is no longer public', async () => {
    pool.query.mockResolvedValueOnce(raceConfig()).mockResolvedValueOnce({ rows: [] });
    await expect(SiteConfigModel.isCharacterRace(R1)).resolves.toBe(false);
  });
});

describe('SiteConfigModel.findCharacterPeople', () => {
  it('returns the summed bonus for a people configured for that race', async () => {
    pool.query.mockResolvedValueOnce(raceConfig()).mockResolvedValueOnce({ rows: [{ id: 'p1', name: 'X', description: null }] });

    await expect(SiteConfigModel.findCharacterPeople(R1, 'p1')).resolves.toEqual({
      bonus: { strength: 2, will: 2 },
    });
  });

  it('returns null for another race without hitting the compendium', async () => {
    pool.query.mockResolvedValueOnce(raceConfig());

    await expect(SiteConfigModel.findCharacterPeople('other', 'p1')).resolves.toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('returns null when the people is no longer public', async () => {
    pool.query.mockResolvedValueOnce(raceConfig()).mockResolvedValueOnce({ rows: [] });

    await expect(SiteConfigModel.findCharacterPeople(R1, 'p1')).resolves.toBeNull();
  });

  it('returns null when the config is not seeded', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(SiteConfigModel.findCharacterPeople(R1, 'p1')).resolves.toBeNull();
  });
});
