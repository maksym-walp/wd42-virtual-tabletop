const SiteConfigModel = require('../models/site-config.model');

const ConfigController = {
  // Довідники для листа персонажа (стани з описами, пари валют). Порожній
  // масив означає «ще не засіяно» — фронтенд тоді бере власні константи.
  async getCharacterConfig(req, res) {
    res.json(await SiteConfigModel.getCharacterConfig());
  },
};

module.exports = ConfigController;
