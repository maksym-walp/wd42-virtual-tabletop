const pool = require('../config/db');
const { deleteWithTrash } = require('../utils/trash');

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

// Canonical = authored by an admin/game_master, or explicitly flagged via the
// "Зробити канонічним" action (s.is_canonical) regardless of owner.
const IS_CANONICAL_EXPR = "(COALESCE(cu.role IN ('admin', 'game_master'), false) OR s.is_canonical)";

// Видимість заклинання під псевдонімом alias для користувача $userParam —
// той самий принцип, що в findById: адмін бачить усе.
const visibleExpr = (alias, userParam, isAdmin) => (isAdmin
  ? 'TRUE'
  : `(${alias}.user_id = ${userParam} OR ${alias}.is_public = true)`);

// «Потрібно вивчити» (батьківське) і «Похідні заклинання» — лише видимі
// запитувачу. derived_spells.is_owner потрібен формі: відчепити/прив'язати
// можна лише власні похідні.
const lineageSelect = (userParam, isAdmin) => `
  (SELECT jsonb_build_object('id', p.id, 'name', p.name)
     FROM spellbook.spells p
     WHERE p.id = s.parent_spell_id AND ${visibleExpr('p', userParam, isAdmin)}) AS parent_spell,
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'is_owner', c.user_id = ${userParam}) ORDER BY c.name)
     FROM spellbook.spells c
     WHERE c.parent_spell_id = s.id AND ${visibleExpr('c', userParam, isAdmin)}),
    '[]'::jsonb
  ) AS derived_spells`;

const COMPLEXITIES = ['primitive', 'simple', 'medium', 'complex', 'extreme'];

const normalizeComplexity = (value) => (COMPLEXITIES.includes(value) ? value : null);

// Рівні заклинання — хронологічні версії. Рівень 1 — це колонки самого
// рядка spells; рівні 2..N лежать у spells.levels (JSONB) як повні знімки
// полів, що можуть змінюватися між версіями. Білий список полів + ті самі
// дефолти, що й для рівня 1 у create — щоб у JSONB не потрапляло сміття з
// тіла запиту чи імпортованого файлу.
function normalizeLevels(levels) {
  if (!Array.isArray(levels)) return [];
  return levels
    .filter((level) => level && typeof level === 'object')
    .map((level) => ({
      complexity: normalizeComplexity(level.complexity),
      spell_kind: level.spell_kind ?? 'utility',
      energy_cost: Number(level.energy_cost) || 0,
      action_time: Number(level.action_time) || 1,
      ritual: level.ritual ?? 'impossible',
      duration_value: level.duration_value === '' || level.duration_value == null ? null : Number(level.duration_value),
      duration_unit: level.duration_unit ?? 'instant',
      range_desc: level.range_desc || null,
      components: Array.isArray(level.components) ? level.components : [],
      mechanical_desc: level.mechanical_desc || null,
      narrative_desc: level.narrative_desc || null,
      lore_creator: level.lore_creator || null,
      lore_creator_npc_id: level.lore_creator_npc_id || null,
    }));
}

// Колонки, які пише bulkImport — той самий набір полів, що create/update
// пишуть сьогодні (плюс lore_creator_npc_id із задачі 1), за винятком
// image_url (немає сенсу тягнути чужий шлях на диску) і
// prerequisite_node_ids/prerequisite_logic/is_canonical (навмисно відсутні —
// див. коментар над bulkImport).
const IMPORT_COLUMNS = [
  'user_id', 'name', 'nature', 'spell_kind', 'mechanical_desc', 'narrative_desc',
  'lore_creator', 'lore_creator_npc_id', 'energy_cost', 'action_time', 'ritual',
  'duration_value', 'duration_unit', 'range_desc', 'components', 'is_public',
  'complexity', 'levels',
];

const JSONB_IMPORT_COLUMNS = ['components', 'levels'];

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
    // lore_creator_npc_id усередині рівнів лишається як є — так само, як і
    // на рівні 1 (IMPORT_COLUMNS його теж переносить).
    case 'levels': return JSON.stringify(normalizeLevels(record.levels));
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
    // Складність може відрізнятися між рівнями — заклинання підходить, якщо
    // хоч один його рівень має обрану складність.
    if (complexity) {
      const complexityArr = Array.isArray(complexity) ? complexity : [complexity];
      params.push(complexityArr);
      conditions.push(`(s.complexity = ANY($${params.length}::text[]) OR EXISTS (SELECT 1 FROM jsonb_array_elements(s.levels) lv WHERE lv->>'complexity' = ANY($${params.length}::text[])))`);
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
              ${traditionsSelect('s')}, ${lineageSelect('$2', isAdmin)},
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
      prerequisite_node_ids, prerequisite_logic, image_url,
      lore_creator, lore_creator_npc_id, complexity, levels, parent_spell_id,
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO spellbook.spells
         (user_id, name, nature, spell_kind, mechanical_desc, narrative_desc,
          energy_cost, action_time, ritual, duration_value, duration_unit,
          range_desc, components, is_public, prerequisite_node_ids, prerequisite_logic,
          image_url, lore_creator, lore_creator_npc_id, complexity, levels, parent_spell_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22)
       RETURNING *`,
      [
        userId, name, nature ?? [], spell_kind ?? 'utility',
        mechanical_desc, narrative_desc,
        energy_cost ?? 0, action_time ?? 1, ritual ?? 'impossible',
        duration_value ?? null, duration_unit ?? 'instant',
        range_desc ?? null, JSON.stringify(components ?? []), is_public ?? false,
        prerequisite_node_ids ?? [], prerequisite_logic ?? 'or',
        image_url ?? null, lore_creator ?? null, lore_creator_npc_id ?? null,
        normalizeComplexity(complexity), JSON.stringify(normalizeLevels(levels)),
        parent_spell_id || null,
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
      prerequisite_node_ids, prerequisite_logic, image_url,
      lore_creator, lore_creator_npc_id, complexity, levels, parent_spell_id,
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
           complexity=$22, levels=$23::jsonb, parent_spell_id=$24, updated_at=NOW()
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
        normalizeComplexity(complexity), JSON.stringify(normalizeLevels(levels)),
        parent_spell_id || null,
      ]
    );
    return rows[0] || null;
  },

  // Перевірка «Потрібно вивчити»/«Похідних» ДО запису: повертає текст
  // помилки або null. spellId — null для ще не створеного заклинання.
  // Дерево лишається деревом: батько не може бути самим заклинанням чи
  // його нащадком, похідне — самим заклинанням, новим батьком чи його
  // предком (інакше утворився б цикл).
  async validateLineage(spellId, userId, { parentId, derivedIds }, isAdmin = false) {
    const derived = Array.isArray(derivedIds) ? derivedIds : [];
    if (parentId) {
      if (parentId === spellId || derived.includes(parentId)) {
        return 'Заклинання не може бути одночасно батьківським і похідним';
      }
      const { rows: parentRows } = await pool.query(
        `SELECT 1 FROM spellbook.spells s WHERE s.id = $1 AND ${visibleExpr('s', '$2', isAdmin)}`,
        [parentId, userId]
      );
      if (!parentRows.length) return 'Батьківське заклинання не знайдено';
      if (spellId) {
        const { rows } = await pool.query(
          `WITH RECURSIVE down AS (
             SELECT id FROM spellbook.spells WHERE parent_spell_id = $1
             UNION
             SELECT c.id FROM spellbook.spells c JOIN down ON c.parent_spell_id = down.id
           ) SELECT 1 FROM down WHERE id = $2`,
          [spellId, parentId]
        );
        if (rows.length) return 'Не можна обрати похідне заклинання як батьківське';
      }
    }
    if (derived.length) {
      if (spellId && derived.includes(spellId)) return 'Заклинання не може бути похідним від себе';
      if (parentId) {
        const { rows } = await pool.query(
          `WITH RECURSIVE up AS (
             SELECT id, parent_spell_id FROM spellbook.spells WHERE id = $1
             UNION
             SELECT p.id, p.parent_spell_id FROM spellbook.spells p JOIN up ON p.id = up.parent_spell_id
           ) SELECT 1 FROM up WHERE id = ANY($2::uuid[])`,
          [parentId, derived]
        );
        if (rows.length) return 'Не можна обрати предка заклинання як похідне';
      }
    }
    return null;
  },

  // Синхронізує «Похідні заклинання»: похідні — це ті, чий parent_spell_id
  // вказує сюди, тож змінюються рядки САМИХ похідних, і лише ті, якими
  // запитувач володіє (або адмін). Чужі похідні не чіпаються.
  async setDerived(spellId, userId, derivedIds, isAdmin = false) {
    const ids = Array.isArray(derivedIds) ? derivedIds.filter((d) => d && d !== spellId) : [];
    await pool.query(
      `UPDATE spellbook.spells SET parent_spell_id = NULL, updated_at = NOW()
       WHERE parent_spell_id = $1 AND NOT (id = ANY($2::uuid[])) AND (user_id = $3 OR $4 = true)`,
      [spellId, ids, userId, isAdmin]
    );
    if (!ids.length) return;
    await pool.query(
      `UPDATE spellbook.spells SET parent_spell_id = $1, updated_at = NOW()
       WHERE id = ANY($2::uuid[]) AND parent_spell_id IS DISTINCT FROM $1 AND (user_id = $3 OR $4 = true)`,
      [spellId, ids, userId, isAdmin]
    );
  },

  // Усе дерево, до якого належить заклинання: піднімаємось до кореня
  // (лише видимими предками), далі спускаємось від кореня всіма видимими
  // нащадками. Плоский список — дерево будує фронтенд за parent_spell_id.
  async findTree(id, userId, isAdmin = false) {
    const { rows } = await pool.query(
      `WITH RECURSIVE up AS (
         SELECT s.id, s.parent_spell_id FROM spellbook.spells s
         WHERE s.id = $1 AND ${visibleExpr('s', '$2', isAdmin)}
         UNION
         SELECT s.id, s.parent_spell_id FROM spellbook.spells s
         JOIN up ON s.id = up.parent_spell_id
         WHERE ${visibleExpr('s', '$2', isAdmin)}
       ),
       root AS (
         SELECT u.id FROM up u WHERE NOT EXISTS (SELECT 1 FROM up u2 WHERE u2.id = u.parent_spell_id)
       ),
       down AS (
         SELECT s.id, s.name, s.parent_spell_id, s.complexity, s.levels, 0 AS depth
         FROM spellbook.spells s WHERE s.id IN (SELECT id FROM root)
         UNION ALL
         SELECT s.id, s.name, s.parent_spell_id, s.complexity, s.levels, down.depth + 1
         FROM spellbook.spells s
         JOIN down ON s.parent_spell_id = down.id
         WHERE ${visibleExpr('s', '$2', isAdmin)} AND down.depth < 50
       )
       SELECT id, name, complexity, 1 + jsonb_array_length(levels) AS level_count,
              CASE WHEN depth = 0 THEN NULL ELSE parent_spell_id END AS parent_spell_id
       FROM down
       ORDER BY depth, name`,
      [id, userId]
    );
    return rows;
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
  // імпортером. prerequisite_node_ids/prerequisite_logic та is_canonical
  // навмисно НЕ входять до списку колонок — новий рядок отримує їхні
  // значення за замовчуванням із таблиці, а не чужий skill-tree/canonical
  // статус з експорту. Рядки без name пропускаються.
  async bulkImport(userId, records) {
    const rows = (records || []).filter((record) => record && record.name);
    if (!rows.length) return 0;

    const values = [];
    const tuples = rows.map((record) => {
      const start = values.length;
      values.push(
        userId,
        ...IMPORT_COLUMNS.slice(1).map((column) => normalizeImportField(column, record))
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
};

module.exports = SpellModel;
module.exports.normalizeLevels = normalizeLevels;
