const SiteConfigModel = require('../models/site-config.model');
const { CONDITION_LEVELS } = require('../rules/conditions');

const ConfigController = {
  // Довідники для листа персонажа (стани з описами, пари валют). Порожній
  // масив означає «ще не засіяно» — фронтенд тоді бере власні константи.
  // condition_levels — тексти ефектів станів по рівнях (з rules/conditions.js),
  // щоб UI не тримав власних таблиць.
  async getCharacterConfig(req, res) {
    res.json({ ...await SiteConfigModel.getCharacterConfig(), condition_levels: CONDITION_LEVELS });
  },
};

module.exports = ConfigController;
