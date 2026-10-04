const crypto = require('crypto');
const pool = require('../config/db');
const { deleteWithTrash } = require('../utils/trash');
const { serializeImageCrop } = require('../utils/image-crop');

const SORT_MAP = {
  name:        's.name ASC',
  action_time: 's.action_time ASC, s.name ASC',
  energy_cost: 's.energy_cost ASC, s.name ASC',
};

const prereqNodesSelect = (alias) => `COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title) ORDER BY n.title)
     FROM skill_tree.nodes n WHERE n.id = ANY(${alias}.prerequisite_node_ids)),
    '[]'::jsonb
  ) AS prerequisite_nodes`;

const traditionsSelect = (alias) => `COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
     FROM spellbook.tradition_spells ts
     JOIN spellbook.traditions t ON t.id = ts.tradition_id
     WHERE ts.spell_id = ${alias}.id),
    '[]'::jsonb
  ) AS traditions`;

// Canonical = the explicit is_canonical flag only (set on create by a GM/admin
// or via the canonical toggle). It used to also include "author is a
// GM/admin", which made those records impossible to un-mark — see
// migration 83.
const IS_CANONICAL_EXPR = 's.is_canonical';

const COMPLEXITIES = ['primitive', 'simple', 'medium', 'complex', 'extreme'];

const normalizeComplexity = (value) => (COMPLEXITIES.includes(value) ? value : null);

const TIER_KINDS = ['primitive', 'perfected'];
const FORM_KINDS = [...TIER_KINDS, 'alternative'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Форми заклинання. Колонки самого рядка spells — основна форма (при
// рівневих формах — «Повноцінна»); spells.forms (JSONB) — додаткові:
// рівневі 'primitive'/'perfected' (не більше однієї кожного виду, id = kind)
// та альтернативні 'alternative' з власною назвою (id — uuid; наявний
// зберігається, бо на нього посилається лист персонажа). Білий список полів
// + ті самі дефолти, що й для основної форми у create — щоб у JSONB не
// потрапляло сміття з тіла запиту чи імпортованого файлу.
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
      complexity: normalizeComplexity(form.complexity),
      spell_kind: form.spell_kind ?? 'utility',
      energy_cost: Number(form.energy_cost) || 0,
      action_time: Number(form.action_time) || 1,
      ritual: form.ritual ?? 'impossible',
      duration_value: form.duration_value === '' || form.duration_value == null ? null : Number(form.duration_value),
      duration_unit: form.duration_unit ?? 'instant',
      range_desc: form.range_desc || null,
      components: Array.isArray(form.components) ? form.components : [],
      mechanical_desc: form.mechanical_desc || null,
      narrative_desc: form.narrative_desc || null,
      lore_creator: form.lore_creator || null,
      lore_creator_npc_id: form.lore_creator_npc_id || null,
    }));
}

// Заклинання має або рівневі форми, або альтернативні — не обидва типи
// разом. Контролер відхиляє такий запит; bulkImport натомість відкидає
// альтернативні (див. normalizeImportField), щоб не валити весь імпорт.
function hasMixedForms(forms) {
  if (!Array.isArray(forms)) return false;
  const kinds = forms.filter((f) => f && typeof f === 'object').map((f) => f.kind);
  return kinds.includes('alternative') && kinds.some((k) => TIER_KINDS.includes(k));
}

const normalizeMainFormName = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

// Колонки, які пише bulkImport — той самий набір полів, що create/update
// пишуть сьогодні (плюс lore_creator_npc_id із задачі 1), за винятком
// image_url (немає сенсу тягнути чужий шлях на диску) і
// prerequisite_node_ids/prerequisite_logic (навмисно відсутні — див. коментар
// над bulkImport). is_canonical береться з ролі імпортера, а не з файлу.
const IMPORT_COLUMNS = [
  'user_id', 'name', 'nature', 'spell_kind', 'mechanical_desc', 'narrative_desc',
  'lore_creator', 'lore_creator_npc_id', 'energy_cost', 'action_time', 'ritual',
  'duration_value', 'duration_unit', 'range_desc', 'components', 'is_public',
  'complexity', 'forms', 'main_form_name', 'is_canonical',
];

const JSONB_IMPORT_COLUMNS = ['components', 'forms'];

function normalizeImportField(column, record) {
  switch (column) {
    case 'is_public': return record.is_public ?? false;
    case 'nature': return record.nature ?? [];
    case 'spell_kind': return record.spell_kind ?? 'utility';
    case 'ritual': return record.ritual ?? 'impossible';
    case 'duration_unit': return record.duration_unit ?? 'instant';
    case 'energy_cost': return record.energy_cost ?? 0;
    case 'action_time': return record.action_time ?? 1;
    case 'components': return JSON.stringify(record.components ?? []);
    case 'complexity': return normalizeComplexity(record.complexity);
    // lore_creator_npc_id усередині форм лишається як є — так само, як і
    // в основній формі (IMPORT_COLUMNS його теж переносить).
    case 'forms': {
      const forms = normalizeForms(record.forms);
      return JSON.stringify(hasMixedForms(forms) ? forms.filter((f) => f.kind !== 'alternative') : forms);
    }
    case 'main_form_name': return normalizeMainFormName(record.main_form_name);
    default: return record[column] ?? null;
  }
}

const SpellModel = {
  async findAll(userId, { nature, spellKind, ritual, complexity, search, sort, scope, limit, traditionId } = {}, isAdmin = false) {
    const params = [userId];
    // scope=community = public entries authored by other, non-canonical users
    // (used by the Dashboard's "Творіння спільноти" rail) — replaces the
    // default ownership clause instead of appending to it.
    const conditions = scope === 'community'
      ? ['s.is_public = true', 's.user_id <> $1', `NOT ${IS_CANONICAL_EXPR}`]
      : [isAdmin ? 'TRUE' : '(s.user_id = $1 OR s.is_public = true)'];

    if (scope === 'canonical') conditions.push(IS_CANONICAL_EXPR);
    else if (scope === 'user') conditions.push(`NOT ${IS_CANONICAL_EXPR}`);

    // nature/traditionId each accept either a single value or an array (a
    // repeated query param like ?nature=a&nature=b arrives as an array via
    // Express's qs parser) — multiple selected values are OR'd together.
    if (nature) {
      const natureArr = Array.isArray(nature) ? nature : [nature];
      params.push(natureArr);
      conditions.push(`s.nature && $${params.length}::text[]`);
    }
    if (spellKind) {
      params.push(spellKind);
      conditions.push(`s.spell_kind = $${params.length}`);
    }
    if (ritual) {
      params.push(ritual);
      conditions.push(`s.ritual = $${params.length}`);
    }
    // Складність може відрізнятися між формами — заклинання підходить, якщо
    // хоч одна його форма має обрану складність.
    if (complexity) {
      const complexityArr = Array.isArray(complexity) ? complexity : [complexity];
      params.push(complexityArr);
      conditions.push(`(s.complexity = ANY($${params.length}::text[]) OR EXISTS (SELECT 1 FROM jsonb_array_elements(s.forms) f WHERE f->>'complexity' = ANY($${params.length}::text[])))`);
    }
    if (traditionId) {
      const traditionArr = Array.isArray(traditionId) ? traditionId : [traditionId];
      params.push(traditionArr);
      conditions.push(`EXISTS (SELECT 1 FROM spellbook.tradition_spells ts WHERE ts.spell_id = s.id AND ts.tradition_id = ANY($${params.length}::uuid[]))`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`s.name ILIKE $${params.length}`);
    }

    const orderBy = SORT_MAP[sort] || SORT_MAP.name;

    let limitClause = '';
    if (limit) {
      params.push(limit);
      limitClause = ` LIMIT $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT s.*, (s.user_id = $1) AS is_owner, ${prereqNodesSelect('s')},
              ${traditionsSelect('s')},
              ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username
       FROM spellbook.spells s
       LEFT JOIN auth.users cu ON cu.id = s.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}${limitClause}`,
      params
    );
    return rows;
  },

  async findById(id, userId, isAdmin = false) {
    const visibility = isAdmin ? 'TRUE' : '(s.user_id = $2 OR s.is_public = true)';
    const { rows } = await pool.query(
      `SELECT s.*, (s.user_id = $2) AS is_owner, ${prereqNodesSelect('s')},
              ${traditionsSelect('s')},
              ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username
       FROM spellbook.spells s
       LEFT JOIN auth.users cu ON cu.id = s.user_id
       WHERE s.id = $1 AND ${visibility}`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const {
      name, nature, spell_kind, mechanical_desc, narrative_desc,
      energy_cost, action_time, ritual,
      duration_value, duration_unit, range_desc,
      components, is_public,
      prerequisite_node_ids, prerequisite_logic, image_url, image_crop,
      lore_creator, lore_creator_npc_id, complexity, forms, main_form_name, is_canonical,
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO spellbook.spells
         (user_id, name, nature, spell_kind, mechanical_desc, narrative_desc,
          energy_cost, action_time, ritual, duration_value, duration_unit,
          range_desc, components, is_public, prerequisite_node_ids, prerequisite_logic,
          image_url, lore_creator, lore_creator_npc_id, complexity, forms, main_form_name, is_canonical, image_crop)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22,$23,$24::jsonb)
       RETURNING *`,
      [
        userId, name, nature ?? [], spell_kind ?? 'utility',
        mechanical_desc, narrative_desc,
        energy_cost ?? 0, action_time ?? 1, ritual ?? 'impossible',
        duration_value ?? null, duration_unit ?? 'instant',
        range_desc ?? null, JSON.stringify(components ?? []), is_public ?? false,
        prerequisite_node_ids ?? [], prerequisite_logic ?? 'or',
        image_url ?? null, lore_creator ?? null, lore_creator_npc_id ?? null,
        normalizeComplexity(complexity), JSON.stringify(normalizeForms(forms)),
        normalizeMainFormName(main_form_name), is_canonical ?? false,
        serializeImageCrop(image_url ? image_crop : null),
      ]
    );
    return rows[0];
  },

  async update(id, userId, data, isAdmin = false) {
    const {
      name, nature, spell_kind, mechanical_desc, narrative_desc,
      energy_cost, action_time, ritual,
      duration_value, duration_unit, range_desc,
      components, is_public,
      prerequisite_node_ids, prerequisite_logic, image_url, image_crop,
      lore_creator, lore_creator_npc_id, complexity, forms, main_form_name,
    } = data;

    const { rows } = await pool.query(
      `UPDATE spellbook.spells
       SET name=$3, nature=$4, spell_kind=$5,
           mechanical_desc=$6, narrative_desc=$7,
           energy_cost=$8, action_time=$9, ritual=$10,
           duration_value=$11, duration_unit=$12, range_desc=$13,
           components=$14::jsonb, is_public=$15,
           prerequisite_node_ids=$16, prerequisite_logic=$17,
           image_url=$18, lore_creator=$19, lore_creator_npc_id=$20,
           complexity=$22, forms=$23::jsonb, main_form_name=$24, image_crop=$25::jsonb, updated_at=NOW()
       WHERE id=$1 AND (user_id=$2 OR $21 = true)
       RETURNING *`,
      [
        id, userId, name, nature ?? [], spell_kind ?? 'utility',
        mechanical_desc, narrative_desc,
        energy_cost, action_time, ritual,
        duration_value ?? null, duration_unit, range_desc ?? null,
        JSON.stringify(components ?? []), is_public ?? false,
        prerequisite_node_ids ?? [], prerequisite_logic ?? 'or',
        image_url ?? null, lore_creator ?? null, lore_creator_npc_id ?? null, isAdmin,
        normalizeComplexity(complexity), JSON.stringify(normalizeForms(forms)),
        normalizeMainFormName(main_form_name),
        serializeImageCrop(image_url ? image_crop : null),
      ]
    );
    return rows[0] || null;
  },

  async delete(id, userId, isAdmin = false) {
    const record = await deleteWithTrash(pool, {
      schemaName: 'spellbook',
      tableName: 'spells',
      deleteQuery: `DELETE FROM spellbook.spells WHERE id = $1 AND (user_id = $2 OR $3 = true) RETURNING *`,
      deleteParams: [id, userId, isAdmin],
      childQueries: [
        { key: 'collection_items', sql: `SELECT * FROM spellbook.collection_items WHERE spell_id = $1`, params: [id] },
        { key: 'tradition_spells', sql: `SELECT * FROM spellbook.tradition_spells WHERE spell_id = $1`, params: [id] },
      ],
      deletedBy: userId,
    });
    return !!record;
  },

  // GM/admin only — flags a spell canonical regardless of who owns it.
  async setCanonical(id, isCanonical) {
    const { rows } = await pool.query(
      `UPDATE spellbook.spells SET is_canonical=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, isCanonical]
    );
    return rows[0] || null;
  },

  // Admin only — reassign owner by username; EXISTS guards against a typo'd
  // username silently no-oping instead of erroring.
  async setOwner(id, ownerUsername) {
    const { rows } = await pool.query(
      `UPDATE spellbook.spells
       SET user_id = (SELECT id FROM auth.users WHERE username = $2), updated_at = NOW()
       WHERE id = $1 AND EXISTS (SELECT 1 FROM auth.users WHERE username = $2)
       RETURNING *`,
      [id, ownerUsername]
    );
    return rows[0] || null;
  },

  // Import зі /export: один multi-row INSERT (на відміну від equipment — тут
  // лише одна таблиця, а не чотири за видом), user_id примусово стає
  // імпортером. prerequisite_node_ids/prerequisite_logic навмисно НЕ входять
  // до списку колонок — новий рядок отримує їхні значення за замовчуванням
  // із таблиці, а не чужий skill-tree з експорту. is_canonical — не з
  // експорту, а з ролі імпортера (isCanonical). Рядки без name пропускаються.
  async bulkImport(userId, records, isCanonical = false) {
    const rows = (records || []).filter((record) => record && record.name);
    if (!rows.length) return 0;

    const values = [];
    const tuples = rows.map((record) => {
      const start = values.length;
      values.push(
        userId,
        ...IMPORT_COLUMNS.slice(1).map((column) => (
          column === 'is_canonical' ? isCanonical : normalizeImportField(column, record)
        ))
      );
      const placeholders = IMPORT_COLUMNS.map((column, idx) => {
        const paramIdx = start + idx + 1;
        return JSONB_IMPORT_COLUMNS.includes(column) ? `$${paramIdx}::jsonb` : `$${paramIdx}`;
      });
      return `(${placeholders.join(', ')})`;
    });

    const { rowCount } = await pool.query(
      `INSERT INTO spellbook.spells (${IMPORT_COLUMNS.join(', ')}) VALUES ${tuples.join(', ')}`,
      values
    );
    return rowCount;
  },

  // Види заклинань (spell_kind) редагуються з адмін-панелі — читаємо їх
  // напряму з admin.site_configs (cross-schema, як equipment's
  // getWeaponOptions), а не тримаємо захардкодженими.
  async getKindOptions() {
    const { rows } = await pool.query(`SELECT value FROM admin.site_configs WHERE key = 'spell_kinds'`);
    return rows[0]?.value || [];
  },
};

module.exports = SpellModel;
module.exports.normalizeForms = normalizeForms;
module.exports.hasMixedForms = hasMixedForms;
