jest.mock('../../models/site-config.model');

const SiteConfigModel = require('../../models/site-config.model');
const ConfigController = require('../config.controller');

describe('ConfigController.getCharacterConfig', () => {
  it('returns the character config', async () => {
    SiteConfigModel.getCharacterConfig.mockResolvedValue({ conditions: [], currencies: [] });
    const res = { json: jest.fn() };

    await ConfigController.getCharacterConfig({ user: { sub: 'u1' } }, res);

    expect(res.json).toHaveBeenCalledWith({ conditions: [], currencies: [] });
  });
});
