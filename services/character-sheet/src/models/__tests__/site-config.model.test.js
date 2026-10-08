jest.mock('../../config/db');

const pool = require('../../config/db');
const SiteConfigModel = require('../site-config.model');

beforeEach(() => jest.clearAllMocks());

describe('SiteConfigModel.getCharacterConfig', () => {
  it('maps admin.site_configs rows to { conditions, currencies }', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { key: 'conditions', value: [{ key: 'exhaustion', label: 'Втома' }] },
        { key: 'currencies', value: [{ key: 'arbor', label: 'Арбор' }] },
      ],
    });

    await expect(SiteConfigModel.getCharacterConfig()).resolves.toEqual({
      conditions: [{ key: 'exhaustion', label: 'Втома' }],
      currencies: [{ key: 'arbor', label: 'Арбор' }],
    });
    expect(pool.query.mock.calls[0][0]).toMatch(/FROM admin\.site_configs WHERE key IN \('conditions', 'currencies'\)/);
  });

  it('falls back to empty arrays when nothing is seeded', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await expect(SiteConfigModel.getCharacterConfig()).resolves.toEqual({ conditions: [], currencies: [] });
  });
});
