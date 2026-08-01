const pool = require('../config/db');
const { deleteWithTrash } = require('../utils/trash');

// Каталог спорядження живе у чотирьох таблицях — по одній на вид
// (39-equipment-split-tables.sql; артефакти приєднались як четвертий вид у
// 51-merge-artifacts-into-equipment.sql, повернувшись з окремого сервісу).
// Спільні колонки однакові всюди, решта є лише в тієї таблиці, якій вони
// справді потрібні. Колонки `type` більше немає: вид визначає таблиця, а в
// API він і далі віддається як `type`, бо на нього дивляться і лист
// персонажа, і картки каталогу.
const KINDS = {
  item: {
    table: 'equipment.items',
    label: 'Предмет',
    columns: [],
    sortExpr: {},
    filters: {},
  },
  weapon: {
    table: 'equipment.weapons',
    label: 'Зброю',
    columns: ['damage_die', 'weapon_type', 'weapon_grip', 'modifier'],
    sortExpr: {
      damage_die: "NULLIF(regexp_replace(i.damage_die, '[^0-9]', '', 'g'), '')::int",
    },
    filters: { weapon_type: 'i.weapon_type' },
  },
  armor: {
    table: 'equipment.armor',
    label: 'Обладунок',
    columns: ['defense_value', 'armor_weight'],
    sortExpr: { defense_value: 'i.defense_value' },
    filters: { armor_weight: 'i.armor_weight' },
  },
  artifact: {
    table: 'equipment.artifacts',
    label: 'Артефакт',
    columns: ['creator', 'rarity'],
    sortExpr: { rarity: "array_position(ARRAY['common','uncommon','rare','legendary'], i.rarity)" },
    filters: { rarity: 'i.rarity', creator: 'i.creator' },
  },
};

const COMMON_COLUMNS = ['name', 'description', 'is_public', 'price', 'image_url'];
const COMMON_SORT_EXPR = { name: 'i.name', price: 'i.price' };

function buildOrderBy(sortExpr, sort, dir) {
  const expr = sortExpr[sort] || COMMON_SORT_EXPR.name;
  const direction = dir === 'desc' ? 'DESC' : 'ASC';
  if (expr === COMMON_SORT_EXPR.name) return `i.name ${direction}`;
  return `${expr} ${direction} NULLS LAST, i.name ASC`;
}

// Canonical = authored by an admin/game_master, or explicitly flagged via the
// "Зробити канонічним" action (i.is_canonical) regardless of owner. Constant
// SQL (no interpolated input), so it is injection-safe.
const IS_CANONICAL_EXPR = "(COALESCE(cu.role IN ('admin', 'game_master'), false) OR i.is_canonical)";

// Reverse reference into another catalog service's schema — same Postgres
// instance/connection (see services/character-sheet's equipment CATALOG union
// for precedent), so a plain cross-schema subquery is fine. Only used on the
// single-entry detail fetch (findById), not findAll, since it's an
// EXISTS-over-jsonb scan per row and the list view doesn't need it. Respects
// the same visibility rule as spellbook's own queries so a spell private to
// someone else never leaks through an entry's "used in" list.
const usedInSpellsSelect = `COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', sp.id, 'name', sp.name) ORDER BY sp.name)
     FROM spellbook.spells sp
     WHERE EXISTS (
       SELECT 1 FROM jsonb_array_elements(sp.components) c
       WHERE (c->>'item_id')::uuid = i.id
     ) AND (sp.user_id = $2 OR sp.is_public = true)),
    '[]'::jsonb
  ) AS used_in_spells`;

// Спільні колонки чотирьох таблиць у фіксованому порядку — основа для UNION,
// де відсутні для конкретного виду поля добиваються NULL-ами, щоб усі чотири
// гілки мали однакову форму рядка.
const UNION_COMMON = 'id, user_id, name, description, is_public, is_canonical, price, image_url, created_at, updated_at';

// Читальний зріз через усі чотири таблиці: ним живуть спільні списки (пікер
// предметів у листі персонажа, реагенти в заклинаннях) і перехід за голим
// id (/equipment/:id у фронтенді, посилання з заклинань), де вид наперед
// невідомий.
const CATALOG_UNION = `(
        SELECT ${UNION_COMMON}, 'item'::varchar AS type,
               NULL::varchar AS damage_die, NULL::varchar AS weapon_type,
               NULL::varchar AS weapon_grip, NULL::varchar AS modifier,
               NULL::smallint AS defense_value, NULL::varchar AS armor_weight,
               NULL::varchar AS creator, NULL::varchar AS rarity
        FROM equipment.items
        UNION ALL
        SELECT ${UNION_COMMON}, 'weapon'::varchar,
               damage_die, weapon_type, weapon_grip, modifier,
               NULL::smallint, NULL::varchar,
               NULL::varchar, NULL::varchar
        FROM equipment.weapons
        UNION ALL
        SELECT ${UNION_COMMON}, 'armor'::varchar,
               NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar,
               defense_value, armor_weight,
               NULL::varchar, NULL::varchar
        FROM equipment.armor
        UNION ALL
        SELECT ${UNION_COMMON}, 'artifact'::varchar,
               NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar,
               NULL::smallint, NULL::varchar,
               creator, rarity
        FROM equipment.artifacts
      )`;

// Вид не зберігається колонкою, тож дописуємо його до відповіді тут — по
// таблиці, з якої прийшов рядок.
const withType = (rows, kind) => rows.map((row) => ({ ...row, type: kind }));

// У якій із чотирьох таблиць лежить цей id (і чи взагалі видно його користувачу).
async function findKindById(id, userId, isAdmin = false) {
  const visibility = isAdmin ? 'TRUE' : '(user_id = $2 OR is_public = true)';
  const { rows } = await pool.query(
    `SELECT 'item' AS kind FROM equipment.items WHERE id = $1 AND ${visibility}
     UNION ALL
     SELECT 'weapon' FROM equipment.weapons WHERE id = $1 AND ${visibility}
     UNION ALL
     SELECT 'armor' FROM equipment.armor WHERE id = $1 AND ${visibility}
     UNION ALL
     SELECT 'artifact' FROM equipment.artifacts WHERE id = $1 AND ${visibility}
     LIMIT 1`,
    [id, userId]
  );
  return rows[0]?.kind || null;
}

// Форма редагування дозволяє перемкнути вид уже створеного спорядження, а
// види тепер лежать у різних таблицях — тож це переїзд рядка, а не UPDATE.
// Id зберігається (на нього посилаються листи персонажів і компоненти
// заклинань), як і власник із created_at; звʼязки з колекціями лишаються на
// місці, їм лише оновлюється item_kind.
async function moveKind(targetKind, id, userId, data, isAdmin = false) {
  const target = KINDS[targetKind];
  const sources = Object.entries(KINDS).filter(([kind]) => kind !== targetKind);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let source = null;
    for (const [, cfg] of sources) {
      const { rows } = await client.query(
        `DELETE FROM ${cfg.table} WHERE id = $1 AND (user_id = $2 OR $3 = true) RETURNING *`,
        [id, userId, isAdmin]
      );
      if (rows.length) { source = rows[0]; break; }
    }
    if (!source) {
      await client.query('ROLLBACK');
      return null;
    }

    const columns = [...COMMON_COLUMNS, ...target.columns];
    const values = columns.map((column) => normalize(column, data));
    const placeholders = columns.map((_, idx) => `$${idx + 4}`);

    const { rows } = await client.query(
      `INSERT INTO ${target.table} (id, user_id, created_at, ${columns.join(', ')})
       VALUES ($1, $2, $3, ${placeholders.join(', ')})
       RETURNING *`,
      [id, source.user_id, source.created_at, ...values]
    );

    await client.query(
      `UPDATE equipment.collection_items SET item_kind = $2 WHERE item_id = $1`,
      [id, targetKind]
    );

    await client.query('COMMIT');
    return { ...rows[0], type: targetKind };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function normalize(column, data) {
  if (column === 'is_public') return data.is_public ?? false;
  return data[column] ?? null;
}

function createCatalogModel(kind) {
  const { table, columns, sortExpr, filters } = KINDS[kind];
  const writeColumns = [...COMMON_COLUMNS, ...columns];
  const allSortExpr = { ...COMMON_SORT_EXPR, ...sortExpr };

  return {
    kind,
    label: KINDS[kind].label,

    async findAll(userId, query = {}, isAdmin = false) {
      const params = [userId];
      // scope=community = public entries authored by other, non-canonical
      // users (used by the Dashboard's "Творіння спільноти" rail) — replaces
      // the default ownership clause instead of appending to it.
      const conditions = query.scope === 'community'
        ? ['i.is_public = true', 'i.user_id <> $1', `NOT ${IS_CANONICAL_EXPR}`]
        : [isAdmin ? 'TRUE' : '(i.user_id = $1 OR i.is_public = true)'];

      if (query.scope === 'canonical') conditions.push(IS_CANONICAL_EXPR);
      else if (query.scope === 'user') conditions.push(`NOT ${IS_CANONICAL_EXPR}`);

      for (const [param, column] of Object.entries(filters)) {
        if (!query[param]) continue;
        params.push(query[param]);
        conditions.push(`${column} = $${params.length}`);
      }
      if (query.search) {
        params.push(`%${query.search}%`);
        conditions.push(`i.name ILIKE $${params.length}`);
      }

      let limitClause = '';
      if (query.limit) {
        params.push(query.limit);
        limitClause = ` LIMIT $${params.length}`;
      }

      const { rows } = await pool.query(
        `SELECT i.*, (i.user_id = $1) AS is_owner,
                ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username
         FROM ${table} i
         LEFT JOIN auth.users cu ON cu.id = i.user_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY ${buildOrderBy(allSortExpr, query.sort, query.dir)}${limitClause}`,
        params
      );
      return withType(rows, kind);
    },

    async findById(id, userId, isAdmin = false) {
      const visibility = isAdmin ? 'TRUE' : '(i.user_id = $2 OR i.is_public = true)';
      const { rows } = await pool.query(
        `SELECT i.*, (i.user_id = $2) AS is_owner,
                ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username,
                ${usedInSpellsSelect}
         FROM ${table} i
         LEFT JOIN auth.users cu ON cu.id = i.user_id
         WHERE i.id = $1 AND ${visibility}`,
        [id, userId]
      );
      return rows[0] ? { ...rows[0], type: kind } : null;
    },

    async create(userId, data) {
      const values = writeColumns.map((column) => normalize(column, data));
      const placeholders = writeColumns.map((_, idx) => `$${idx + 2}`);
      const { rows } = await pool.query(
        `INSERT INTO ${table} (user_id, ${writeColumns.join(', ')})
         VALUES ($1, ${placeholders.join(', ')})
         RETURNING *`,
        [userId, ...values]
      );
      return { ...rows[0], type: kind };
    },

    async update(id, userId, data, isAdmin = false) {
      const assignments = writeColumns.map((column, idx) => `${column}=$${idx + 4}`);
      const values = writeColumns.map((column) => normalize(column, data));
      const { rows } = await pool.query(
        `UPDATE ${table}
         SET ${assignments.join(', ')}, updated_at=NOW()
         WHERE id=$1 AND (user_id=$2 OR $3 = true)
         RETURNING *`,
        [id, userId, isAdmin, ...values]
      );
      if (rows[0]) return { ...rows[0], type: kind };
      // Рядка тут немає — можливо, в формі перемкнули вид спорядження, і він
      // досі лежить у таблиці попереднього виду.
      return moveKind(kind, id, userId, data, isAdmin);
    },

    async delete(id, userId, isAdmin = false) {
      const record = await deleteWithTrash(pool, {
        schemaName: 'equipment',
        tableName: table.split('.')[1],
        // Звʼязки з колекціями більше не мають FK на каталог (item_id вказує
        // на одну з чотирьох таблиць), тож каскаду немає — прибираємо їх самі.
        // CTE виконується завжди, але вся операція в транзакції, яку
        // deleteWithTrash відкочує, якщо основний DELETE нічого не зачепив.
        deleteQuery: `WITH unlinked AS (
                        DELETE FROM equipment.collection_items WHERE item_id = $1
                      )
                      DELETE FROM ${table} WHERE id = $1 AND (user_id = $2 OR $3 = true) RETURNING *`,
        deleteParams: [id, userId, isAdmin],
        childQueries: [
          { key: 'collection_items', sql: `SELECT * FROM equipment.collection_items WHERE item_id = $1`, params: [id] },
        ],
        deletedBy: userId,
      });
      return !!record;
    },

    // GM/admin only — flags an entry canonical regardless of who owns it.
    async setCanonical(id, isCanonical) {
      const { rows } = await pool.query(
        `UPDATE ${table} SET is_canonical=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
        [id, isCanonical]
      );
      return rows[0] ? { ...rows[0], type: kind } : null;
    },
  };
}

// Спільний список/деталь через усі чотири таблиці — для тих, кому вид наперед
// невідомий або неважливий.
const UnionModel = {
  async findAll(userId, { search, scope, sort, dir, limit } = {}, isAdmin = false) {
    const params = [userId];
    const conditions = scope === 'community'
      ? ['i.is_public = true', 'i.user_id <> $1', `NOT ${IS_CANONICAL_EXPR}`]
      : [isAdmin ? 'TRUE' : '(i.user_id = $1 OR i.is_public = true)'];

    if (scope === 'canonical') conditions.push(IS_CANONICAL_EXPR);
    else if (scope === 'user') conditions.push(`NOT ${IS_CANONICAL_EXPR}`);
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`i.name ILIKE $${params.length}`);
    }

    let limitClause = '';
    if (limit) {
      params.push(limit);
      limitClause = ` LIMIT $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT i.*, (i.user_id = $1) AS is_owner,
              ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username
       FROM ${CATALOG_UNION} i
       LEFT JOIN auth.users cu ON cu.id = i.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${buildOrderBy(COMMON_SORT_EXPR, sort, dir)}${limitClause}`,
      params
    );
    return rows;
  },

  async findById(id, userId, isAdmin = false) {
    const visibility = isAdmin ? 'TRUE' : '(i.user_id = $2 OR i.is_public = true)';
    const { rows } = await pool.query(
      `SELECT i.*, (i.user_id = $2) AS is_owner,
              ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username,
              ${usedInSpellsSelect}
       FROM ${CATALOG_UNION} i
       LEFT JOIN auth.users cu ON cu.id = i.user_id
       WHERE i.id = $1 AND ${visibility}`,
      [id, userId]
    );
    return rows[0] || null;
  },
};

module.exports = {
  KINDS,
  CATALOG_UNION,
  createCatalogModel,
  findKindById,
  UnionModel,
};
