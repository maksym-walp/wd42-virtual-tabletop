const pool = require('../config/db');

// Cross-schema читання карток для Столу/Ширми: лише «картка» (назва,
// підзаголовок, зображення, опис) — без статів і приватних нотаток, бо цей
// знімок пізніше побачать гравці. Видимість повторює правила сервісів-
// власників (публічне, власне або адмін), щоб майстер не міг витягнути на
// стіл чужий приватний запис. Сервіси не мають спільного коду, лише БД.

const EQUIPMENT_TABLES = {
  item: 'equipment.items',
  weapon: 'equipment.weapons',
  armor: 'equipment.armor',
  artifact: 'equipment.artifacts',
};

// $1 = ref_id, $2 = user id, $3 = isAdmin
const VISIBLE = (ownerColumn) => `($3::bool OR ${ownerColumn} = $2 OR is_public = true)`;

const QUERIES = {
  npc: `
    SELECT e.name AS title, sp.name AS subtitle, e.image_url, e.image_crop, e.description AS content
    FROM npcs.npcs e
    LEFT JOIN compendium.species sp ON sp.id = e.species_id
    WHERE e.id = $1 AND ($3::bool OR e.created_by = $2 OR e.is_public = true)`,
  creature: `
    SELECT e.name AS title, sp.name AS subtitle, e.image_url, e.image_crop, e.description AS content
    FROM bestiary.creatures e
    LEFT JOIN compendium.species sp ON sp.id = e.species_id
    WHERE e.id = $1 AND ($3::bool OR e.created_by = $2 OR e.is_public = true)`,
  spell: `
    SELECT name AS title, NULL::text AS subtitle, image_url, image_crop,
           COALESCE(NULLIF(narrative_desc, ''), mechanical_desc) AS content
    FROM spellbook.spells
    WHERE id = $1 AND ${VISIBLE('user_id')}`,
  ability: `
    SELECT name AS title, NULL::text AS subtitle, image_url, image_crop,
           COALESCE(NULLIF(narrative_desc, ''), mechanical_desc) AS content
    FROM abilities.entries
    WHERE id = $1 AND ${VISIBLE('user_id')}`,
  faction: `
    SELECT name AS title, NULL::text AS subtitle, symbol_url AS image_url, NULL::jsonb AS image_crop,
           description AS content
    FROM npcs.factions
    WHERE id = $1 AND ${VISIBLE('created_by')}`,
  // Локації читають усі (у maps.locations немає is_public); беремо найновішу
  // версію. gm_note версії навмисно не читаємо.
  location: `
    SELECT COALESCE(v.name, l.name) AS title, NULL::text AS subtitle, v.image_url, NULL::jsonb AS image_crop,
           v.description AS content
    FROM maps.locations l
    LEFT JOIN LATERAL (
      SELECT name, image_url, description FROM maps.location_versions
      WHERE location_id = l.id
      ORDER BY start_year DESC NULLS LAST, created_at DESC
      LIMIT 1
    ) v ON true
    WHERE l.id = $1`,
  map: `
    SELECT name AS title, NULL::text AS subtitle,
           COALESCE(preview_thumbnail_url, preview_image_url) AS image_url, NULL::jsonb AS image_crop,
           NULL::text AS content
    FROM maps.maps
    WHERE id = $1 AND ${VISIBLE('created_by')}`,
};

function equipmentQuery(subtype) {
  const table = EQUIPMENT_TABLES[subtype];
  if (!table) return null;
  return `
    SELECT name AS title, NULL::text AS subtitle, COALESCE(thumbnail_url, image_url) AS image_url,
           image_crop, description AS content
    FROM ${table}
    WHERE id = $1 AND ${VISIBLE('user_id')}`;
}

const SOURCE_KINDS = [...Object.keys(QUERIES), 'equipment'];

const BoardSourceModel = {
  SOURCE_KINDS,
  EQUIPMENT_SUBTYPES: Object.keys(EQUIPMENT_TABLES),

  // null, якщо запису немає або користувач не може його читати.
  async resolve(kind, refId, refSubtype, user) {
    const sql = kind === 'equipment' ? equipmentQuery(refSubtype) : QUERIES[kind];
    if (!sql) return null;
    const params = kind === 'location' ? [refId] : [refId, user.sub, user.role === 'admin'];
    const { rows } = await pool.query(sql, params);
    return rows[0] || null;
  },
};

module.exports = BoardSourceModel;
