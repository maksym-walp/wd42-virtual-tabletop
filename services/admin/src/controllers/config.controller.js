const ConfigModel = require('../models/config.model');

// Набір типів зброї (weapon_types), особливостей зброї (weapon_grips),
// видів заклинань (spell_kinds), станів персонажа (conditions) і валют
// (currencies), форм магії (magic_forms) і типів подій хронології (event_types). equipment/spellbook/character-sheet читають їх напряму
// через cross-schema SQL (equipment's getWeaponOptions, spellbook's
// getKindOptions, character-sheet's GET /config), тож цей HTTP API
// обслуговує лише саму адмін-панель.
const ALLOWED_KEYS = ['weapon_types', 'weapon_grips', 'spell_kinds', 'conditions', 'currencies', 'magic_forms', 'character_races', 'event_types'];

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

// Форми магії: набір ключів фіксований (CHECK spells_nature_check у БД,
// міграція 93) — адмін редагує лише назви й описи, не додає/видаляє/
// перейменовує ключі.
const MAGIC_FORM_KEYS = ['arcana', 'elemental', 'integral', 'pact', 'nature', 'blight'];

function validateMagicForms(value) {
  const base = validateValue(value);
  if (base) return base;
  const keys = value.map((entry) => entry.key);
  const missing = MAGIC_FORM_KEYS.filter((key) => !keys.includes(key));
  const unknown = keys.filter((key) => !MAGIC_FORM_KEYS.includes(key));
  if (missing.length || unknown.length) {
    return `набір форм магії фіксований: ${MAGIC_FORM_KEYS.join(', ')}`;
  }
  for (const entry of value) {
    const descError = validateDescription(entry);
    if (descError) return descError;
  }
  return null;
}

// Раси персонажа: які публічні раси компендіуму (race_id) гравець може обрати,
// їхня механіка (+1 до 4 навичок однієї характеристики та/або додаткові очки
// пулу) і підвиди — народи компендіуму (people_id) з бонусами до навичок
// (skill → value). На відміну від решти конфігів, порожній список коректний
// (рас ще не відкрито). Ключі характеристик і навичок фіксовані (CHECK у
// character_sheet.skills). Існування й публічність записів компендіуму тут не
// перевіряємо — character-sheet відсіює недоступні при читанні.
const CHARACTERISTIC_KEYS = ['agility', 'physique', 'intellect', 'wisdom', 'charisma'];
const SKILL_KEYS = [
  'evasion', 'acrobatics', 'stealth', 'sleight_of_hand',
  'strength', 'immunity', 'magic_sense', 'endurance',
  'history', 'nature', 'erudition', 'mysticism',
  'intuition', 'spellcasting', 'cleverness', 'perception',
  'will', 'deception', 'artistry', 'persuasion',
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PEOPLE_BONUS = 5;
const MAX_RACE_BUDGET = 20;

function validatePeopleEntry(entry, seenPeoples) {
  if (!entry || typeof entry.people_id !== 'string' || !UUID_PATTERN.test(entry.people_id)) {
    return 'кожен підвид має мати people_id (UUID народу з компендіуму)';
  }
  if (seenPeoples.has(entry.people_id)) return `підвид ${entry.people_id} уже додано до цієї раси`;
  seenPeoples.add(entry.people_id);

  const bonuses = entry.skill_bonuses ?? [];
  if (!Array.isArray(bonuses)) return 'skill_bonuses має бути масивом';
  const seenSkills = new Set();
  for (const bonus of bonuses) {
    if (!bonus || !SKILL_KEYS.includes(bonus.skill)) return `невідома навичка: ${bonus?.skill}`;
    if (seenSkills.has(bonus.skill)) return `навичка ${bonus.skill} повторюється у підвиду ${entry.people_id}`;
    seenSkills.add(bonus.skill);
    if (!Number.isInteger(bonus.value) || bonus.value < 1 || bonus.value > MAX_PEOPLE_BONUS) {
      return `бонус до ${bonus.skill} має бути цілим від 1 до ${MAX_PEOPLE_BONUS}`;
    }
  }
  return null;
}

function validateCharacterRaces(value) {
  if (!Array.isArray(value)) return 'value має бути масивом';
  const seenRaces = new Set();
  for (const entry of value) {
    if (!entry || typeof entry.race_id !== 'string' || !UUID_PATTERN.test(entry.race_id)) {
      return 'кожна раса має мати race_id (UUID раси з компендіуму)';
    }
    if (seenRaces.has(entry.race_id)) return `раса ${entry.race_id} додана двічі`;
    seenRaces.add(entry.race_id);

    if (entry.bonus_characteristic != null && !CHARACTERISTIC_KEYS.includes(entry.bonus_characteristic)) {
      return `невідома характеристика: ${entry.bonus_characteristic}`;
    }
    const budget = entry.bonus_budget ?? 0;
    if (!Number.isInteger(budget) || budget < 0 || budget > MAX_RACE_BUDGET) {
      return `додаткові очки раси мають бути цілим від 0 до ${MAX_RACE_BUDGET}`;
    }

    const peoples = entry.peoples ?? [];
    if (!Array.isArray(peoples)) return 'peoples має бути масивом';
    const seenPeoples = new Set();
    for (const people of peoples) {
      const error = validatePeopleEntry(people, seenPeoples);
      if (error) return error;
    }
  }
  return null;
}

// Типи подій хронології: key/label як у решти конфігів + колір (#rrggbb), яким
// відображаються події цього типу. chronology читає їх напряму з
// admin.site_configs (ChronologyEventModel.getEventTypes). Порожній список
// коректний — події тоді користуються власним кольором.
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function validateEventTypes(value) {
  if (!Array.isArray(value)) return 'value має бути масивом';
  if (value.length === 0) return null;
  const base = validateValue(value);
  if (base) return base;
  for (const entry of value) {
    if (typeof entry.color !== 'string' || !HEX_COLOR_PATTERN.test(entry.color)) {
      return `колір типу "${entry.label}" має бути у форматі #rrggbb`;
    }
  }
  return null;
}

const VALIDATORS = {
  event_types: validateEventTypes,
  conditions: validateConditions,
  currencies: validateCurrencies,
  magic_forms: validateMagicForms,
  character_races: validateCharacterRaces,
};

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
