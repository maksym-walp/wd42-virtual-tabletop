const ConfigModel = require('../models/config.model');

// Набір типів зброї (weapon_types), особливостей зброї (weapon_grips),
// видів заклинань (spell_kinds), станів персонажа (conditions) і валют
// (currencies). equipment/spellbook/character-sheet читають їх напряму
// через cross-schema SQL (equipment's getWeaponOptions, spellbook's
// getKindOptions, character-sheet's GET /config), тож цей HTTP API
// обслуговує лише саму адмін-панель.
const ALLOWED_KEYS = ['weapon_types', 'weapon_grips', 'spell_kinds', 'conditions', 'currencies'];

const MAX_DESCRIPTION_LENGTH = 2000;

// key стає сирим значенням у записах (weapon_type/weapon_grip/spell_kind)
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

function validateDescription(entry) {
  if (entry.description == null) return null;
  if (typeof entry.description !== 'string') return 'description має бути рядком';
  if (entry.description.length > MAX_DESCRIPTION_LENGTH) {
    return `description довший за ${MAX_DESCRIPTION_LENGTH} символів`;
  }
  return null;
}

// Стани: key/label як у решти конфігів + опис і необовʼязковий максимальний
// рівень (null — без обмеження). key — значення type у conditions персонажа.
function validateConditions(value) {
  const base = validateValue(value);
  if (base) return base;
  for (const entry of value) {
    const descError = validateDescription(entry);
    if (descError) return descError;
    const max = entry.max_level;
    if (max != null && (!Number.isInteger(max) || max < 1 || max > 20)) {
      return `max_level стану "${entry.key}" має бути цілим від 1 до 20 або порожнім`;
    }
  }
  return null;
}

function validateDenomination(denom, where) {
  if (!denom || typeof denom !== 'object') return `${where}: номінал обовʼязковий`;
  if (typeof denom.key !== 'string' || !KEY_PATTERN.test(denom.key)) {
    return `${where}: key номіналу має містити лише латинські малі літери, цифри й "_"`;
  }
  if (typeof denom.name !== 'string' || !denom.name.trim()) return `${where}: назва номіналу обовʼязкова`;
  if (denom.metal != null && typeof denom.metal !== 'string') return `${where}: metal має бути рядком`;
  return null;
}

// Валюти — пари номіналів (старший/молодший) одного регіону. Ключі номіналів
// — ключі в money персонажа, тож мають бути унікальні в усьому конфігу.
function validateCurrencies(value) {
  const base = validateValue(value);
  if (base) return base;
  const denomKeys = new Set();
  for (const entry of value) {
    const descError = validateDescription(entry);
    if (descError) return descError;
    for (const side of ['high', 'low']) {
      const error = validateDenomination(entry[side], `${entry.label} (${side === 'high' ? 'старший' : 'молодший'})`);
      if (error) return error;
      if (denomKeys.has(entry[side].key)) return `дублікат key номіналу: ${entry[side].key}`;
      denomKeys.add(entry[side].key);
    }
    if (typeof entry.convertible !== 'boolean') return `convertible пари "${entry.label}" має бути true/false`;
    if (entry.convertible && (!Number.isInteger(entry.rate) || entry.rate < 2)) {
      return `курс пари "${entry.label}" має бути цілим числом не менше 2`;
    }
  }
  return null;
}

const VALIDATORS = { conditions: validateConditions, currencies: validateCurrencies };

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

    const error = (VALIDATORS[key] ?? validateValue)(req.body.value);
    if (error) return res.status(400).json({ message: error });

    const config = await ConfigModel.upsert(key, req.body.value);
    res.json({ config });
  },
};

module.exports = ConfigController;
