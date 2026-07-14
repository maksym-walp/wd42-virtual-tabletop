const pool = require('../config/db');

const itemFields = `jsonb_build_object(
    'id', m.id, 'name', m.name, 'duration_actions', m.duration_actions,
    'description', m.description, 'is_public', m.is_public,
    'prerequisite_node_ids', m.prerequisite_node_ids,
    'prerequisite_logic', m.prerequisite_logic
  )`;

const itemsSelect = `COALESCE(
    (SELECT jsonb_agg(${itemFields} ORDER BY m.name)
     FROM maneuvers.collection_items ci
     JOIN maneuvers.entries m ON m.id = ci.maneuver_id
     WHERE ci.collection_id = c.id),
    '[]'::jsonb
  ) AS items`;

const CollectionModel = {
  async findAll(userId, { search } = {}) {
    const params = [userId];
    const conditions = ['(c.user_id = $1 OR c.is_public = true)'];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`c.name ILIKE $${params.length}`);
    }
    const { rows } = await pool.query(
      `SELECT c.*, (c.user_id = $1) AS is_owner, ${itemsSelect}
       FROM maneuvers.collections c
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name ASC`,
      params
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT c.*, (c.user_id = $2) AS is_owner, ${itemsSelect}
       FROM maneuvers.collections c
       WHERE c.id = $1 AND (c.user_id = $2 OR c.is_public = true)`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async findPublicById(id) {
    const { rows } = await pool.query(
      `SELECT c.*, false AS is_owner, ${itemsSelect}
       FROM maneuvers.collections c
       WHERE c.id = $1 AND c.is_public = true`,
      [id]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const { name, description, is_public, prerequisite_node_ids, prerequisite_logic } = data;
    const { rows } = await pool.query(
      `INSERT INTO maneuvers.collections
         (user_id, name, description, is_public, prerequisite_node_ids, prerequisite_logic)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [userId, name, description ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or']
    );
    return rows[0];
  },

  async update(id, userId, data) {
    const { name, description, is_public, prerequisite_node_ids, prerequisite_logic } = data;
    const { rows } = await pool.query(
      `UPDATE maneuvers.collections
       SET name=$3, description=$4, is_public=$5,
           prerequisite_node_ids=$6, prerequisite_logic=$7, updated_at=NOW()
       WHERE id=$1 AND user_id=$2
       RETURNING *`,
      [id, userId, name, description ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or']
    );
    return rows[0] || null;
  },

  async delete(id, userId) {
    const { rowCount } = await pool.query(
      'DELETE FROM maneuvers.collections WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rowCount > 0;
  },

  // Only the collection owner can add items, and only items they can see
  // (own or public) — mirrors the character-sheet add-item visibility guard.
  async addItem(collectionId, userId, maneuverId) {
    const owns = await pool.query(
      'SELECT 1 FROM maneuvers.collections WHERE id = $1 AND user_id = $2',
      [collectionId, userId]
    );
    if (!owns.rows.length) return null;

    const visible = await pool.query(
      'SELECT 1 FROM maneuvers.entries WHERE id = $1 AND (user_id = $2 OR is_public = true)',
      [maneuverId, userId]
    );
    if (!visible.rows.length) return null;

    const { rows } = await pool.query(
      `INSERT INTO maneuvers.collection_items (collection_id, maneuver_id)
       VALUES ($1, $2)
       ON CONFLICT (collection_id, maneuver_id) DO NOTHING
       RETURNING *`,
      [collectionId, maneuverId]
    );
    return rows[0] || { collection_id: collectionId, maneuver_id: maneuverId };
  },

  async removeItem(collectionId, userId, maneuverId) {
    const { rowCount } = await pool.query(
      `DELETE FROM maneuvers.collection_items ci
       USING maneuvers.collections c
       WHERE ci.collection_id = c.id AND c.id = $1 AND c.user_id = $2 AND ci.maneuver_id = $3`,
      [collectionId, userId, maneuverId]
    );
    return rowCount > 0;
  },
};

module.exports = CollectionModel;
