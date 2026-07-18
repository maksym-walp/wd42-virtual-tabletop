const pool = require('../config/db');

const itemFields = `jsonb_build_object(
    'id', i.id, 'name', i.name, 'type', i.type,
    'damage_die', i.damage_die, 'defense_value', i.defense_value,
    'description', i.description, 'is_public', i.is_public,
    'price', i.price, 'image_url', i.image_url,
    'weapon_type', i.weapon_type, 'weapon_grip', i.weapon_grip,
    'armor_weight', i.armor_weight, 'creator', i.creator, 'rarity', i.rarity
  )`;

const itemsSelect = `COALESCE(
    (SELECT jsonb_agg(${itemFields} ORDER BY i.name)
     FROM equipment.collection_items ci
     JOIN equipment.items i ON i.id = ci.item_id
     WHERE ci.collection_id = c.id),
    '[]'::jsonb
  ) AS items`;

const CollectionModel = {
  async findAll(userId, { search, scope } = {}) {
    const params = [userId];
    const conditions = ['(c.user_id = $1 OR c.is_public = true)'];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`c.name ILIKE $${params.length}`);
    }
    // Canonical = authored by an admin; user = everyone else. Constant SQL.
    if (scope === 'canonical') conditions.push("cu.role = 'admin'");
    else if (scope === 'user') conditions.push("cu.role IS DISTINCT FROM 'admin'");
    const { rows } = await pool.query(
      `SELECT c.*, (c.user_id = $1) AS is_owner,
              COALESCE(cu.role = 'admin', false) AS is_canonical, ${itemsSelect}
       FROM equipment.collections c
       LEFT JOIN auth.users cu ON cu.id = c.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name ASC`,
      params
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT c.*, (c.user_id = $2) AS is_owner,
              COALESCE(cu.role = 'admin', false) AS is_canonical, ${itemsSelect}
       FROM equipment.collections c
       LEFT JOIN auth.users cu ON cu.id = c.user_id
       WHERE c.id = $1 AND (c.user_id = $2 OR c.is_public = true)`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async findPublicById(id) {
    const { rows } = await pool.query(
      `SELECT c.*, false AS is_owner,
              COALESCE(cu.role = 'admin', false) AS is_canonical, ${itemsSelect}
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

  async update(id, userId, data) {
    const { name, description, is_public } = data;
    const { rows } = await pool.query(
      `UPDATE equipment.collections
       SET name=$3, description=$4, is_public=$5, updated_at=NOW()
       WHERE id=$1 AND user_id=$2
       RETURNING *`,
      [id, userId, name, description ?? null, is_public ?? false]
    );
    return rows[0] || null;
  },

  async delete(id, userId) {
    const { rowCount } = await pool.query(
      'DELETE FROM equipment.collections WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rowCount > 0;
  },

  // Only the collection owner can add items, and only items they can see
  // (own or public) — mirrors the character-sheet add-item visibility guard.
  async addItem(collectionId, userId, itemId) {
    const owns = await pool.query(
      'SELECT 1 FROM equipment.collections WHERE id = $1 AND user_id = $2',
      [collectionId, userId]
    );
    if (!owns.rows.length) return null;

    const visible = await pool.query(
      'SELECT 1 FROM equipment.items WHERE id = $1 AND (user_id = $2 OR is_public = true)',
      [itemId, userId]
    );
    if (!visible.rows.length) return null;

    const { rows } = await pool.query(
      `INSERT INTO equipment.collection_items (collection_id, item_id)
       VALUES ($1, $2)
       ON CONFLICT (collection_id, item_id) DO NOTHING
       RETURNING *`,
      [collectionId, itemId]
    );
    return rows[0] || { collection_id: collectionId, item_id: itemId };
  },

  async removeItem(collectionId, userId, itemId) {
    const { rowCount } = await pool.query(
      `DELETE FROM equipment.collection_items ci
       USING equipment.collections c
       WHERE ci.collection_id = c.id AND c.id = $1 AND c.user_id = $2 AND ci.item_id = $3`,
      [collectionId, userId, itemId]
    );
    return rowCount > 0;
  },
};

module.exports = CollectionModel;
