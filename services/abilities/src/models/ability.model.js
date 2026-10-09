const crypto = require('crypto');
const pool = require('../config/db');
const { deleteWithTrash } = require('../utils/trash');
const { serializeImageCrop } = require('../utils/image-crop');

const SORT_MAP = {
  name: 'a.name ASC',
};

const prereqNodesSelect = (alias) => `COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title) ORDER BY n.title)
     FROM skill_tree.nodes n WHERE n.id = ANY(${alias}.prerequisite_node_ids)),
    '[]'::jsonb
  ) AS prerequisite_nodes`;

// Canonical = the explicit is_canonical flag only (set on create by a GM/admin
// or via the canonical toggle). It used to also include "author is a
// GM/admin", which made those records impossible to un-mark — see
// migration 83.
const IS_CANONICAL_EXPR = 'a.is_canonical';

const TIER_KINDS = ['primitive', 'perfected'];
const FORM_KINDS = [...TIER_KINDS, 'alternative'];
const DURATION_UNITS = ['instant', 'action', 'seconds', 'minutes', 'hours', 'days', 'permanent'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Форми вміння — та сама модель, що й у заклинань (spellbook
// normalizeForms). Колонки самого рядка entries — основна форма (при
// рівневих формах — «Повноцінна»); entries.forms (JSONB) — додаткові:
// рівневі 'primitive'/'perfected' (не більше однієї кожного виду, id = kind)
// та альтернативні 'alternative' з власною назвою (id — uuid; наявний
// зберігається, бо на нього посилаються лист персонажа й вузли дерева).
// Білий список полів, щоб у JSONB не потрапляло сміття з тіла запиту.
// is_maneuver/archetypes — властивості вміння загалом, не форми.
function normalizeForms(forms) {
  if (!Array.isArray(forms)) return [];
  const seenTiers = new Set();
  return forms
    .filter((form) => form && typeof form === 'object' && FORM_KINDS.includes(form.kind))
    .filter((form) => {
      if (!TIER_KINDS.includes(form.kind)) return true;
      if (seenTiers.has(form.kind)) return false;
      seenTiers.add(form.kind);
      return true;
    })
    .map((form) => ({
      kind: form.kind,
      id: form.kind === 'alternative'
        ? (UUID_RE.test(form.id ?? '') ? form.id : crypto.randomUUID())
        : form.kind,
      name: form.kind === 'alternative' ? (String(form.name ?? '').trim() || 'Альтернативна форма') : null,
      duration_value: form.duration_value === '' || form.duration_value == null ? null : Number(form.duration_value),
      duration_unit: DURATION_UNITS.includes(form.duration_unit) ? form.duration_unit : 'instant',
      mechanical_desc: form.mechanical_desc || null,
      narrative_desc: form.narrative_desc || null,
      lore_creator: form.lore_creator || null,
      lore_creator_npc_id: form.lore_creator_npc_id || null,
    }));
}

// Вміння має або рівневі форми, або альтернативні — не обидва типи разом.
// Контролер відхиляє такий запит; bulkImport натомість відкидає
// альтернативні, щоб не валити весь імпорт.
function hasMixedForms(forms) {
  if (!Array.isArray(forms)) return false;
  const kinds = forms.filter((f) => f && typeof f === 'object').map((f) => f.kind);
  return kinds.includes('alternative') && kinds.some((k) => TIER_KINDS.includes(k));
}

const normalizeMainFormName = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

function serializeForms(forms) {
  const normalized = normalizeForms(forms);
  return JSON.stringify(hasMixedForms(normalized) ? normalized.filter((f) => f.kind !== 'alternative') : normalized);
}

const AbilityModel = {
  async findAll(userId, { search, sort, archetype, scope, limit, is_maneuver } = {}, isAdmin = false) {
    const params = [userId];
    // scope=community = public entries authored by other, non-canonical users
    // (used by the Dashboard's "Творіння спільноти" rail) — replaces the
    // default ownership clause instead of appending to it.
    const conditions = scope === 'community'
      ? ['a.is_public = true', 'a.user_id <> $1', `NOT ${IS_CANONICAL_EXPR}`]
      : [isAdmin ? 'TRUE' : '(a.user_id = $1 OR a.is_public = true)'];

    if (scope === 'canonical') conditions.push(IS_CANONICAL_EXPR);
    else if (scope === 'user') conditions.push(`NOT ${IS_CANONICAL_EXPR}`);

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`a.name ILIKE $${params.length}`);
    }
    if (archetype) {
      params.push(archetype);
      conditions.push(`$${params.length} = ANY(a.archetypes)`);
    }
    // is_maneuver arrives as the string 'true'/'false' from a query param —
    // any other value (including '' / undefined) leaves the filter off.
    if (is_maneuver === 'true' || is_maneuver === true) {
      conditions.push('a.is_maneuver = true');
    } else if (is_maneuver === 'false' || is_maneuver === false) {
      conditions.push('a.is_maneuver = false');
    }

    const orderBy = SORT_MAP[sort] || SORT_MAP.name;

    let limitClause = '';
    if (limit) {
      params.push(limit);
      limitClause = ` LIMIT $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT a.*, (a.user_id = $1) AS is_owner, ${prereqNodesSelect('a')},
              ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username
       FROM abilities.entries a
       LEFT JOIN auth.users cu ON cu.id = a.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}${limitClause}`,
      params
    );
    return rows;
  },

  async findById(id, userId, isAdmin = false) {
    const visibility = isAdmin ? 'TRUE' : '(a.user_id = $2 OR a.is_public = true)';
    const { rows } = await pool.query(
      `SELECT a.*, (a.user_id = $2) AS is_owner, ${prereqNodesSelect('a')},
              ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username
       FROM abilities.entries a
       LEFT JOIN auth.users cu ON cu.id = a.user_id
       WHERE a.id = $1 AND ${visibility}`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const {
      name, archetypes, mechanical_desc, narrative_desc, is_public, prerequisite_node_ids, prerequisite_logic, image_url,
      is_maneuver, duration_value, duration_unit, lore_creator, lore_creator_npc_id, is_canonical, image_crop,
      forms, main_form_name,
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO abilities.entries
         (user_id, name, archetypes, mechanical_desc, narrative_desc, is_public, prerequisite_node_ids, prerequisite_logic, image_url,
          is_maneuver, duration_value, duration_unit, lore_creator, lore_creator_npc_id, is_canonical, image_crop,
          forms, main_form_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18)
       RETURNING *`,
      [
        userId, name, archetypes ?? [], mechanical_desc ?? null, narrative_desc ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or', image_url ?? null,
        is_maneuver ?? false, duration_value ?? null, duration_unit ?? 'instant', lore_creator ?? null, lore_creator_npc_id ?? null,
        is_canonical ?? false, serializeImageCrop(image_url ? image_crop : null),
        serializeForms(forms), normalizeMainFormName(main_form_name),
      ]
    );
    return rows[0];
  },

  async update(id, userId, data, isAdmin = false) {
    const {
      name, archetypes, mechanical_desc, narrative_desc, is_public, prerequisite_node_ids, prerequisite_logic, image_url,
      is_maneuver, duration_value, duration_unit, lore_creator, lore_creator_npc_id, image_crop,
      forms, main_form_name,
    } = data;

    const { rows } = await pool.query(
      `UPDATE abilities.entries
       SET name=$3, archetypes=$4, mechanical_desc=$5, narrative_desc=$6, is_public=$7,
           prerequisite_node_ids=$8, prerequisite_logic=$9, image_url=$10,
           is_maneuver=$11, duration_value=$12, duration_unit=$13,
           lore_creator=$14, lore_creator_npc_id=$15, image_crop=$17::jsonb,
           forms=$18::jsonb, main_form_name=$19, updated_at=NOW()
       WHERE id=$1 AND (user_id=$2 OR $16 = true)
       RETURNING *`,
      [
        id, userId, name, archetypes ?? [], mechanical_desc ?? null, narrative_desc ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or', image_url ?? null,
        is_maneuver ?? false, duration_value ?? null, duration_unit ?? 'instant', lore_creator ?? null, lore_creator_npc_id ?? null, isAdmin,
        serializeImageCrop(image_url ? image_crop : null),
        serializeForms(forms), normalizeMainFormName(main_form_name),
      ]
    );
    return rows[0] || null;
  },

  async delete(id, userId, isAdmin = false) {
    const record = await deleteWithTrash(pool, {
      schemaName: 'abilities',
      tableName: 'entries',
      deleteQuery: `DELETE FROM abilities.entries WHERE id = $1 AND (user_id = $2 OR $3 = true) RETURNING *`,
      deleteParams: [id, userId, isAdmin],
      childQueries: [
        { key: 'collection_items', sql: `SELECT * FROM abilities.collection_items WHERE ability_id = $1`, params: [id] },
      ],
      deletedBy: userId,
    });
    return !!record;
  },

  // GM/admin only — flags an ability canonical regardless of who owns it.
  async setCanonical(id, isCanonical) {
    const { rows } = await pool.query(
      `UPDATE abilities.entries SET is_canonical=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, isCanonical]
    );
    return rows[0] || null;
  },

  // Admin only — reassign owner by username; EXISTS guards against a typo'd
  // username silently no-oping instead of erroring.
  async setOwner(id, ownerUsername) {
    const { rows } = await pool.query(
      `UPDATE abilities.entries
       SET user_id = (SELECT id FROM auth.users WHERE username = $2), updated_at = NOW()
       WHERE id = $1 AND EXISTS (SELECT 1 FROM auth.users WHERE username = $2)
       RETURNING *`,
      [id, ownerUsername]
    );
    return rows[0] || null;
  },

  // Bulk import previously exported abilities: a single table, so no kind
  // grouping like equipment's union — one multi-row INSERT for the whole
  // batch. Rows with no name are skipped (name is required). user_id is
  // forced to the importer; prerequisite_node_ids/prerequisite_logic and
  // image_url are deliberately left off the write-column list so they take
  // their table defaults instead of trusting the file — prerequisite node ids
  // belong to a specific user's skill tree and are meaningless to a different
  // importer. is_canonical comes from the importer's role, not the file.
  async bulkImport(userId, records, isCanonical = false) {
    const valid = records.filter((record) => record && record.name);
    if (!valid.length) return 0;

    const columns = [
      'user_id', 'name', 'archetypes', 'mechanical_desc', 'narrative_desc', 'is_public',
      'is_maneuver', 'duration_value', 'duration_unit', 'lore_creator', 'lore_creator_npc_id', 'is_canonical',
      'forms', 'main_form_name',
    ];

    const values = [];
    const tuples = valid.map((record) => {
      const start = values.length;
      values.push(
        userId,
        record.name,
        record.archetypes ?? [],
        record.mechanical_desc ?? null,
        record.narrative_desc ?? null,
        record.is_public ?? false,
        record.is_maneuver ?? false,
        record.duration_value ?? null,
        record.duration_unit ?? 'instant',
        record.lore_creator ?? null,
        record.lore_creator_npc_id ?? null,
        isCanonical,
        serializeForms(record.forms),
        normalizeMainFormName(record.main_form_name),
      );
      return `(${columns.map((_, idx) => `$${start + idx + 1}`).join(', ')})`;
    });

    const { rowCount } = await pool.query(
      `INSERT INTO abilities.entries (${columns.join(', ')}) VALUES ${tuples.join(', ')}`,
      values
    );
    return rowCount;
  },
};

module.exports = AbilityModel;
module.exports.normalizeForms = normalizeForms;
module.exports.hasMixedForms = hasMixedForms;
