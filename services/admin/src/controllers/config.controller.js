const ConfigModel = require('../models/config.model');

// Наразі рівно два конфіги — набір типів зброї (weapon_types) і набір
// особливостей зброї (weapon_grips). equipment-сервіс читає їх напряму
// через cross-schema SQL (services/equipment/src/models/catalog.model.js
// getWeaponOptions), тож цей HTTP API обслуговує лише саму адмін-панель.
const ALLOWED_KEYS = ['weapon_types', 'weapon_grips'];

// key стає сирим значенням у записах каталогу зброї (weapon_type/weapon_grip)
// і трапляється у query-параметрах фільтрів — адмін вводить його вручну
// (фронтенд валідує тим самим патерном), тож дублюємо перевірку тут, а не
// довіряємо клієнту.
const KEY_PATTERN = /^[a-z0-9_]+$/;

function validateValue(value) {
  if (!Array.isArray(value) || value.length === 0) return 'value має бути непорожнім масивом';
  const seenKeys = new Set();
  for (const entry of value) {
    if (!entry || typeof entry.key !== 'string' || !entry.key.trim()) return 'кожен елемент має мати непорожній key';
    if (!KEY_PATTERN.test(entry.key)) return `key "${entry.key}" має містити лише латинські малі літери, цифри й "_"`;
    if (typeof entry.label !== 'string' || !entry.label.trim()) return 'кожен елемент має мати непорожній label';
    if (seenKeys.has(entry.key)) return `дублікат key: ${entry.key}`;
    seenKeys.add(entry.key);
  }
  return null;
}

const ConfigController = {
  async list(req, res) {
    const configs = await ConfigModel.findAll();
    res.json({ configs });
  },

  async getOne(req, res) {
    const config = await ConfigModel.findByKey(req.params.key);
    if (!config) return res.status(404).json({ message: 'Конфіг не знайдено' });
    res.json({ config });
  },

  async update(req, res) {
    const { key } = req.params;
    if (!ALLOWED_KEYS.includes(key)) return res.status(404).json({ message: 'Конфіг не знайдено' });

    const error = validateValue(req.body.value);
    if (error) return res.status(400).json({ message: error });

    const config = await ConfigModel.upsert(key, req.body.value);
    res.json({ config });
  },
};

module.exports = ConfigController;
