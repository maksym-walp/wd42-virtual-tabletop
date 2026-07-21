const pool = require('../config/db');

const itemFields = `jsonb_build_object(
    'id', m.id, 'name', m.name, 'duration_actions', m.duration_actions,
    'description', m.description, 'is_public', m.is_public,
    'prerequisite_node_ids', m.prerequisite_node_ids,
    'prerequisite_logic', m.prerequisite_logic,
    'image_url', m.image_url
  )`;

const itemsSelect = `COALESCE(
    (SELECT jsonb_agg(${itemFields} ORDER BY m.name)
     FROM maneuvers.collection_items ci
     JOIN maneuvers.entries m ON m.id = ci.maneuver_id
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
    if (scope === 'canonical') conditions.push(IS_CANONICAL_EXPR);
    else if (scope === 'user') conditions.push(`NOT ${IS_CANONICAL_EXPR}`);
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`c.name ILIKE $${params.length}`);
    }
    const { rows } = await pool.query(
      `SELECT c.*, (c.user_id = $1) AS is_owner,
              ${IS_CANONICAL_EXPR} AS is_canonical, ${itemsSelect}
       FROM maneuvers.collections c
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
       FROM maneuvers.collections c
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
       FROM maneuvers.collections c
       LEFT JOIN auth.users cu ON cu.id = c.user_id
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

  async update(id, userId, data, isAdmin = false) {
    const { name, description, is_public, prerequisite_node_ids, prerequisite_logic } = data;
    const ownerCheck = isAdmin ? 'TRUE' : 'user_id=$2';
    const { rows } = await pool.query(
      `UPDATE maneuvers.collections
       SET name=$3, description=$4, is_public=$5,
           prerequisite_node_ids=$6, prerequisite_logic=$7, updated_at=NOW()
       WHERE id=$1 AND ${ownerCheck}
       RETURNING *`,
      [id, userId, name, description ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or']
    );
    return rows[0] || null;
  },

  async delete(id, userId, isAdmin = false) {
    const ownerCheck = isAdmin ? 'TRUE' : 'user_id = $2';
    const { rowCount } = await pool.query(
      `DELETE FROM maneuvers.collections WHERE id = $1 AND ${ownerCheck}`,
      [id, userId]
    );
    return rowCount > 0;
  },

  // GM/admin only — flags a collection canonical regardless of who owns it.
  async setCanonical(id, isCanonical) {
    const { rows } = await pool.query(
      `UPDATE maneuvers.collections SET is_canonical=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, isCanonical]
    );
    return rows[0] || null;
  },

  // Only the collection owner (or admin) can add items, and only items they
  // can see (own or public, or anything if admin).
  async addItem(collectionId, userId, maneuverId, isAdmin = false) {
    const ownerCheck = isAdmin ? 'TRUE' : 'user_id = $2';
    const owns = await pool.query(
      `SELECT 1 FROM maneuvers.collections WHERE id = $1 AND ${ownerCheck}`,
      [collectionId, userId]
    );
    if (!owns.rows.length) return null;

    const visibleCheck = isAdmin ? 'TRUE' : '(user_id = $2 OR is_public = true)';
    const visible = await pool.query(
      `SELECT 1 FROM maneuvers.entries WHERE id = $1 AND ${visibleCheck}`,
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

  async removeItem(collectionId, userId, maneuverId, isAdmin = false) {
    const ownerCheck = isAdmin ? 'TRUE' : 'c.user_id = $2';
    const { rowCount } = await pool.query(
      `DELETE FROM maneuvers.collection_items ci
       USING maneuvers.collections c
       WHERE ci.collection_id = c.id AND c.id = $1 AND ${ownerCheck} AND ci.maneuver_id = $3`,
      [collectionId, userId, maneuverId]
    );
    return rowCount > 0;
  },
};

module.exports = CollectionModel;
