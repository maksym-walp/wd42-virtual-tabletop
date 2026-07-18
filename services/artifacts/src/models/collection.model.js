const pool = require('../config/db');

const artifactFields = `jsonb_build_object(
    'id', a.id, 'name', a.name,
    'description', a.description, 'is_public', a.is_public,
    'price', a.price, 'image_url', a.image_url,
    'creator', a.creator, 'rarity', a.rarity
  )`;

const itemsSelect = `COALESCE(
    (SELECT jsonb_agg(${artifactFields} ORDER BY a.name)
     FROM artifacts.collection_items ci
     JOIN artifacts.entries a ON a.id = ci.artifact_id
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
       FROM artifacts.collections c
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
       FROM artifacts.collections c
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
       FROM artifacts.collections c
       LEFT JOIN auth.users cu ON cu.id = c.user_id
       WHERE c.id = $1 AND c.is_public = true`,
      [id]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const { name, description, is_public } = data;
    const { rows } = await pool.query(
      `INSERT INTO artifacts.collections
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
      `UPDATE artifacts.collections
       SET name=$3, description=$4, is_public=$5, updated_at=NOW()
       WHERE id=$1 AND user_id=$2
       RETURNING *`,
      [id, userId, name, description ?? null, is_public ?? false]
    );
    return rows[0] || null;
  },

  async delete(id, userId) {
    const { rowCount } = await pool.query(
      'DELETE FROM artifacts.collections WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rowCount > 0;
  },

  // Only the collection owner can add artifacts, and only artifacts they can
  // see (own or public) — same guard as equipment's collection model.
  async addItem(collectionId, userId, artifactId) {
    const owns = await pool.query(
      'SELECT 1 FROM artifacts.collections WHERE id = $1 AND user_id = $2',
      [collectionId, userId]
    );
    if (!owns.rows.length) return null;

    const visible = await pool.query(
      'SELECT 1 FROM artifacts.entries WHERE id = $1 AND (user_id = $2 OR is_public = true)',
      [artifactId, userId]
    );
    if (!visible.rows.length) return null;

    const { rows } = await pool.query(
      `INSERT INTO artifacts.collection_items (collection_id, artifact_id)
       VALUES ($1, $2)
       ON CONFLICT (collection_id, artifact_id) DO NOTHING
       RETURNING *`,
      [collectionId, artifactId]
    );
    return rows[0] || { collection_id: collectionId, artifact_id: artifactId };
  },

  async removeItem(collectionId, userId, artifactId) {
    const { rowCount } = await pool.query(
      `DELETE FROM artifacts.collection_items ci
       USING artifacts.collections c
       WHERE ci.collection_id = c.id AND c.id = $1 AND c.user_id = $2 AND ci.artifact_id = $3`,
      [collectionId, userId, artifactId]
    );
    return rowCount > 0;
  },
};

module.exports = CollectionModel;
