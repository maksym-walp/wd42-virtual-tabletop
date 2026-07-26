const pool = require('../config/db');
const { deleteWithTrash } = require('../utils/trash');
const { CATALOG_UNION, findKindById } = require('./catalog.model');

// Колекція збирає спорядження будь-якого виду (набір «стартове спорядження»
// цілком може містити і меч, і кірасу, і мотузку), тож звʼязка вказує на одну
// з трьох таблиць каталогу: item_id + item_kind, який каже, на яку саме.
const itemFields = `jsonb_build_object(
    'id', i.id, 'name', i.name, 'type', i.type,
    'damage_die', i.damage_die, 'defense_value', i.defense_value,
    'description', i.description, 'is_public', i.is_public,
    'price', i.price, 'image_url', i.image_url,
    'weapon_type', i.weapon_type, 'weapon_grip', i.weapon_grip,
    'armor_weight', i.armor_weight
  )`;

const itemsSelect = `COALESCE(
    (SELECT jsonb_agg(${itemFields} ORDER BY i.name)
     FROM equipment.collection_items ci
     JOIN ${CATALOG_UNION} i ON i.id = ci.item_id AND i.type = ci.item_kind
     WHERE ci.collection_id = c.id),
    '[]'::jsonb
  ) AS items`;

// Canonical = authored by an admin/game_master, or explicitly flagged via the
// "Зробити канонічним" action (c.is_canonical) regardless of owner.
const IS_CANONICAL_EXPR = "(COALESCE(cu.role IN ('admin', 'game_master'), false) OR c.is_canonical)";

const CollectionModel = {
  async findAll(userId, { search, scope } = {}, isAdmin = false) {
    const params = [userId];
    const conditions = [isAdmin ? 'TRUE' : '(c.user_id = $1 OR c.is_public = true)'];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`c.name ILIKE $${params.length}`);
    }
    if (scope === 'canonical') conditions.push(IS_CANONICAL_EXPR);
    else if (scope === 'user') conditions.push(`NOT ${IS_CANONICAL_EXPR}`);
    const { rows } = await pool.query(
      `SELECT c.*, (c.user_id = $1) AS is_owner,
              ${IS_CANONICAL_EXPR} AS is_canonical, ${itemsSelect}
       FROM equipment.collections c
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
       FROM equipment.collections c
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
       FROM equipment.collections c
       LEFT JOIN auth.users cu ON cu.id = c.user_id
       WHERE c.id = $1 AND c.is_public = true`,
      [id]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const { name, description, is_public } = data;
    const { rows } = await pool.query(
      `INSERT INTO equipment.collections
         (user_id, name, description, is_public)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [userId, name, description ?? null, is_public ?? false]
    );
    return rows[0];
  },

  async update(id, userId, data, isAdmin = false) {
    const { name, description, is_public } = data;
    const { rows } = await pool.query(
      `UPDATE equipment.collections
       SET name=$3, description=$4, is_public=$5, updated_at=NOW()
       WHERE id=$1 AND (user_id=$2 OR $6 = true)
       RETURNING *`,
      [id, userId, name, description ?? null, is_public ?? false, isAdmin]
    );
    return rows[0] || null;
  },

  async delete(id, userId, isAdmin = false) {
    const record = await deleteWithTrash(pool, {
      schemaName: 'equipment',
      tableName: 'collections',
      deleteQuery: `DELETE FROM equipment.collections WHERE id = $1 AND (user_id = $2 OR $3 = true) RETURNING *`,
      deleteParams: [id, userId, isAdmin],
      childQueries: [
        { key: 'collection_items', sql: `SELECT * FROM equipment.collection_items WHERE collection_id = $1`, params: [id] },
      ],
      deletedBy: userId,
    });
    return !!record;
  },

  // GM/admin only — flags a collection canonical regardless of who owns it.
  async setCanonical(id, isCanonical) {
    const { rows } = await pool.query(
      `UPDATE equipment.collections SET is_canonical=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, isCanonical]
    );
    return rows[0] || null;
  },

  // Only the collection owner (or admin) can add items, and only items they
  // can see (own or public, or anything if admin) — mirrors the
  // character-sheet add-item visibility guard. Вид визначається тут, з тієї
  // таблиці, у якій знайшовся id, — клієнту не треба його передавати.
  async addItem(collectionId, userId, itemId, isAdmin = false) {
    const owns = await pool.query(
      `SELECT 1 FROM equipment.collections WHERE id = $1 AND (user_id = $2 OR $3 = true)`,
      [collectionId, userId, isAdmin]
    );
    if (!owns.rows.length) return null;

    const kind = await findKindById(itemId, userId, isAdmin);
    if (!kind) return null;

    const { rows } = await pool.query(
      `INSERT INTO equipment.collection_items (collection_id, item_id, item_kind)
       VALUES ($1, $2, $3)
       ON CONFLICT (collection_id, item_id) DO NOTHING
       RETURNING *`,
      [collectionId, itemId, kind]
    );
    return rows[0] || { collection_id: collectionId, item_id: itemId, item_kind: kind };
  },

  async removeItem(collectionId, userId, itemId, isAdmin = false) {
    const { rowCount } = await pool.query(
      `DELETE FROM equipment.collection_items ci
       USING equipment.collections c
       WHERE ci.collection_id = c.id AND c.id = $1 AND (c.user_id = $2 OR $4 = true) AND ci.item_id = $3`,
      [collectionId, userId, itemId, isAdmin]
    );
    return rowCount > 0;
  },
};

module.exports = CollectionModel;
