const SettingsModel = require('../models/settings.model');

const ARCHETYPES = ['fighter', 'spellcaster', 'rogue'];
const LAYOUTS = ['tree', 'star'];
const MAX_URL_LENGTH = 500;

const SettingsController = {
  async list(req, res) {
    const settings = await SettingsModel.findAll();
    res.json({ settings });
  },

  async update(req, res) {
    const { archetype } = req.params;
    if (!ARCHETYPES.includes(archetype)) {
      return res.status(400).json({ message: 'Невідома вкладка дерева' });
    }

    const body = req.body || {};
    const patch = {};

    if ('layout' in body) {
      if (!LAYOUTS.includes(body.layout)) {
        return res.status(400).json({ message: 'layout має бути "tree" або "star"' });
      }
      patch.layout = body.layout;
    }

    if ('background_url' in body) {
      const url = body.background_url;
      if (url === null || url === '') {
        patch.background_url = null;
      } else if (typeof url === 'string' && url.length <= MAX_URL_LENGTH && /^(\/|https?:\/\/)/.test(url)) {
        patch.background_url = url;
      } else {
        return res.status(400).json({ message: 'Некоректне посилання на зображення' });
      }
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'Нічого оновлювати' });
    }

    const settings = await SettingsModel.upsert(archetype, patch);
    res.json({ settings });
  },
};

module.exports = SettingsController;
