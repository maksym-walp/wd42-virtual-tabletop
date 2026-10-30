const pool = require('../config/db');

// Стани й валюти персонажа редагуються з адмін-панелі й живуть у
// admin.site_configs — той самий Postgres, що й campaigns.* у
// campaign-access.model.js, тож звичайний cross-schema SELECT.
//
// character_races — [{ race_id, is_main?, bonus_characteristic,
// bonus_value? (±N до 4 навичок, типово 1), bonus_budget,
// peoples: [{ people_id, skill_bonuses: [{ skill, value }] }] }]: які раси
// компендіуму (compendium.races) гравець може обрати, що вони дають механічно
// і які народи (compendium.peoples) доступні як підвид. Назви, описи й
// зображення беремо з компендіуму; приватні записи гравцям не показуємо.
async function loadPublic(table, ids, columns) {
  if (!ids.length) return new Map();
  const { rows } = await pool.query(
    `SELECT id, ${columns} FROM compendium.${table} WHERE id = ANY($1::uuid[]) AND is_public = true`,
    [ids]
  );
  return new Map(rows.map((r) => [r.id, r]));
}

const loadRaces = (ids) => loadPublic('races', ids, 'name, description, image_url');
const loadPeoples = (ids) => loadPublic('peoples', ids, 'name, description');

async function readRaceEntries() {
  const { rows: [config] } = await pool.query(
    `SELECT value FROM admin.site_configs WHERE key = 'character_races'`
  );
  return Array.isArray(config?.value) ? config.value : [];
}

// Сума бонусів підвиду по навичках: { skill_key: n }.
function sumBonuses(skillBonuses) {
  const bonus = {};
  for (const { skill, value } of skillBonuses || []) bonus[skill] = (bonus[skill] || 0) + value;
  return bonus;
}

const SiteConfigModel = {
  async getCharacterConfig() {
    const { rows } = await pool.query(
      `SELECT key, value FROM admin.site_configs WHERE key IN ('conditions', 'currencies', 'character_races')`
    );
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    const entries = Array.isArray(byKey.character_races) ? byKey.character_races : [];
    const [raceMap, peopleMap] = await Promise.all([
      loadRaces(entries.map((e) => e.race_id)),
      loadPeoples(entries.flatMap((e) => (e.peoples || []).map((p) => p.people_id))),
    ]);

    const races = entries
      .filter((e) => raceMap.has(e.race_id))
      .map((e) => {
        const race = raceMap.get(e.race_id);
        return {
          id: e.race_id,
          name: race.name,
          description: race.description,
          image_url: race.image_url,
          is_main: e.is_main !== false,
          bonus_characteristic: e.bonus_characteristic ?? null,
          bonus_value: e.bonus_value ?? 1,
          bonus_budget: e.bonus_budget ?? 0,
          peoples: (e.peoples || [])
            .filter((p) => peopleMap.has(p.people_id))
            .map((p) => ({
              id: p.people_id,
              name: peopleMap.get(p.people_id).name,
              description: peopleMap.get(p.people_id).description,
              skill_bonuses: p.skill_bonuses || [],
            })),
        };
      });

    return {
      conditions: byKey.conditions || [],
      currencies: byKey.currencies || [],
      races,
    };
  },

  // Раса, відкрита адміном для персонажів (і ще публічна) → true/false.
  async isCharacterRace(raceId) {
    const entry = (await readRaceEntries()).find((e) => e.race_id === raceId);
    if (!entry) return false;
    return (await loadRaces([raceId])).has(raceId);
  },

  // Підвид peopleId раси raceId → { bonus: { skill_key: n } } або null, якщо
  // адмін його для цієї раси не відкривав (або народ уже не публічний).
  async findCharacterPeople(raceId, peopleId) {
    const entry = (await readRaceEntries()).find((e) => e.race_id === raceId);
    const people = (entry?.peoples || []).find((p) => p.people_id === peopleId);
    if (!people) return null;
    if (!(await loadPeoples([peopleId])).has(peopleId)) return null;
    return { bonus: sumBonuses(people.skill_bonuses) };
  },
};

module.exports = SiteConfigModel;
