const pool = require('../config/db');
const { deleteWithTrash } = require('../utils/trash');

// Колекція збирає вміння й маневри разом (вміння вже й так змішує архетипи в
// одній колекції, тож змішування видів — той самий крок), тож звʼязка
// вказує на одну з двох таблиць: item_id + item_kind, який каже, на яку саме
// (той самий патерн, що й у equipment/collection.model.js).
const itemFields = `jsonb_build_object(
    'id', i.id, 'name', i.name, 'description', i.description,
    'type', i.type,
    'archetypes', i.archetypes, 'duration_actions', i.duration_actions,
    'is_public', i.is_public,
    'prerequisite_node_ids', i.prerequisite_node_ids,
    'prerequisite_logic', i.prerequisite_logic,
    'image_url', i.image_url
  )`;

// Спільний читальний зріз через обидві таблиці — для itemsSelect нижче і для
// findKindById. Відсутні для конкретного виду поля добиваються NULL-ами.
const ENTRY_UNION = `(
        SELECT id, user_id, name, description, is_public, is_canonical,
               prerequisite_node_ids, prerequisite_logic, image_url, created_at, updated_at,
               'ability'::varchar AS type, archetypes, NULL::smallint AS duration_actions
        FROM abilities.entries
        UNION ALL
        SELECT id, user_id, name, description, is_public, is_canonical,
               prerequisite_node_ids, prerequisite_logic, image_url, created_at, updated_at,
               'maneuver'::varchar, NULL::text[], duration_actions
        FROM abilities.maneuvers
      )`;

const itemsSelect = `COALESCE(
    (SELECT jsonb_agg(${itemFields} ORDER BY i.name)
     FROM abilities.collection_items ci
     JOIN ${ENTRY_UNION} i ON i.id = ci.item_id AND i.type = ci.item_kind
     WHERE ci.collection_id = c.id),
    '[]'::jsonb
  ) AS items`;

// У якій із двох таблиць лежить цей id (і чи взагалі видно його користувачу).
async function findKindById(id, userId, isAdmin = false) {
  const visibility = isAdmin ? 'TRUE' : '(user_id = $2 OR is_public = true)';
  const { rows } = await pool.query(
    `SELECT 'ability' AS kind FROM abilities.entries WHERE id = $1 AND ${visibility}
     UNION ALL
     SELECT 'maneuver' FROM abilities.maneuvers WHERE id = $1 AND ${visibility}
     LIMIT 1`,
    [id, userId]
  );
  return rows[0]?.kind || null;
}

// Canonical = authored by an admin/game_master, or explicitly flagged via the
// "Зробити канонічним" action (c.is_canonical) regardless of owner.
const IS_CANONICAL_EXPR = "(COALESCE(cu.role IN ('admin', 'game_master'), false) OR c.is_canonical)";

const CollectionModel = {
  async findAll(userId, { search, scope } = {}, isAdmin = false) {
    const params = [userId];
    const conditions = [isAdmin ? 'TRUE' : '(c.user_id = $1 OR c.is_public = true)'];
    if (scope === 'canonical') conditions.push(IS_CANONICAL_EXPR);
    else if (scope === 'user') conditions.push(`NOT ${IS_CANONICAL_EXPR}`);
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`c.name ILIKE $${params.length}`);
    }
    const { rows } = await pool.query(
      `SELECT c.*, (c.user_id = $1) AS is_owner,
              ${IS_CANONICAL_EXPR} AS is_canonical, ${itemsSelect}
       FROM abilities.collections c
       LEFT JOIN auth.users cu ON cu.id = c.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name ASC`,
      params
    );
    return rows;
  },

  async findById(id, userId, isAdmin = false) {
    const visibility = isAdmin ? 'TRUE' : '(c.user_id = $2 OR c.is_public = true)';
    const { rows } = await pool.query(
      `SELECT c.*, (c.user_id = $2) AS is_owner,
              ${IS_CANONICAL_EXPR} AS is_canonical, ${itemsSelect}
       FROM abilities.collections c
       LEFT JOIN auth.users cu ON cu.id = c.user_id
       WHERE c.id = $1 AND ${visibility}`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async findPublicById(id) {
    const { rows } = await pool.query(
      `SELECT c.*, false AS is_owner,
              ${IS_CANONICAL_EXPR} AS is_canonical, ${itemsSelect}
       FROM abilities.collections c
       LEFT JOIN auth.users cu ON cu.id = c.user_id
       WHERE c.id = $1 AND c.is_public = true`,
      [id]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const { name, description, is_public, prerequisite_node_ids, prerequisite_logic, image_url } = data;
    const { rows } = await pool.query(
      `INSERT INTO abilities.collections
         (user_id, name, description, is_public, prerequisite_node_ids, prerequisite_logic, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [userId, name, description ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or', image_url ?? null]
    );
    return rows[0];
  },

  async update(id, userId, data, isAdmin = false) {
    const { name, description, is_public, prerequisite_node_ids, prerequisite_logic, image_url } = data;
    const { rows } = await pool.query(
      `UPDATE abilities.collections
       SET name=$3, description=$4, is_public=$5,
           prerequisite_node_ids=$6, prerequisite_logic=$7, image_url=$8, updated_at=NOW()
       WHERE id=$1 AND (user_id=$2 OR $9 = true)
       RETURNING *`,
      [id, userId, name, description ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or', image_url ?? null, isAdmin]
    );
    return rows[0] || null;
  },

  async delete(id, userId, isAdmin = false) {
    const record = await deleteWithTrash(pool, {
      schemaName: 'abilities',
      tableName: 'collections',
      deleteQuery: `DELETE FROM abilities.collections WHERE id = $1 AND (user_id = $2 OR $3 = true) RETURNING *`,
      deleteParams: [id, userId, isAdmin],
      childQueries: [
        { key: 'collection_items', sql: `SELECT * FROM abilities.collection_items WHERE collection_id = $1`, params: [id] },
      ],
      deletedBy: userId,
    });
    return !!record;
  },

  // GM/admin only — flags a collection canonical regardless of who owns it.
  async setCanonical(id, isCanonical) {
    const { rows } = await pool.query(
      `UPDATE abilities.collections SET is_canonical=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, isCanonical]
    );
    return rows[0] || null;
  },

  // Only the collection owner (or admin) can add items, and only items they
  // can see (own or public, or anything if admin). Вид визначається тут, з
  // тієї таблиці, у якій знайшовся id, — клієнту не треба його передавати.
  async addItem(collectionId, userId, itemId, isAdmin = false) {
    const owns = await pool.query(
      `SELECT 1 FROM abilities.collections WHERE id = $1 AND (user_id = $2 OR $3 = true)`,
      [collectionId, userId, isAdmin]
    );
    if (!owns.rows.length) return null;

    const kind = await findKindById(itemId, userId, isAdmin);
    if (!kind) return null;

    const { rows } = await pool.query(
      `INSERT INTO abilities.collection_items (collection_id, item_id, item_kind)
       VALUES ($1, $2, $3)
       ON CONFLICT (collection_id, item_id) DO NOTHING
       RETURNING *`,
      [collectionId, itemId, kind]
    );
    return rows[0] || { collection_id: collectionId, item_id: itemId, item_kind: kind };
  },

  async removeItem(collectionId, userId, itemId, isAdmin = false) {
    const { rowCount } = await pool.query(
      `DELETE FROM abilities.collection_items ci
       USING abilities.collections c
       WHERE ci.collection_id = c.id AND c.id = $1 AND (c.user_id = $2 OR $4 = true) AND ci.item_id = $3`,
      [collectionId, userId, itemId, isAdmin]
    );
    return rowCount > 0;
  },
};

module.exports = CollectionModel;
