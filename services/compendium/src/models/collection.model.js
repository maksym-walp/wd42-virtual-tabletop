const pool = require('../config/db');

const entryFields = `jsonb_build_object(
    'id', e.id, 'name', e.name, 'entity_type', e.entity_type,
    'description', e.description, 'is_public', e.is_public, 'image_url', e.image_url
  )`;

const itemsSelect = `COALESCE(
    (SELECT jsonb_agg(${entryFields} ORDER BY e.name)
     FROM compendium.collection_items ci
     JOIN compendium.compendium_entries e ON e.id = ci.entry_id
     WHERE ci.collection_id = c.id),
    '[]'::jsonb
  ) AS items`;

const CollectionModel = {
  async findAll(userId, { search } = {}, isAdmin = false) {
    const params = [userId];
    const conditions = [isAdmin ? 'TRUE' : '(c.created_by = $1 OR c.is_public = true)'];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`c.name ILIKE $${params.length}`);
    }
    const { rows } = await pool.query(
      `SELECT c.*, (c.created_by = $1) AS is_owner, ${itemsSelect}
       FROM compendium.collections c
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name ASC`,
      params
    );
    return rows;
  },

  async findById(id, userId, isAdmin = false) {
    const visibility = isAdmin ? 'TRUE' : '(c.created_by = $2 OR c.is_public = true)';
    const { rows } = await pool.query(
      `SELECT c.*, (c.created_by = $2) AS is_owner, ${itemsSelect}
       FROM compendium.collections c
       WHERE c.id = $1 AND ${visibility}`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async findPublicById(id) {
    const { rows } = await pool.query(
      `SELECT c.*, false AS is_owner, ${itemsSelect}
       FROM compendium.collections c
       WHERE c.id = $1 AND c.is_public = true`,
      [id]
    );
    return rows[0] || null;
  },

  async create(userId, { name, description, is_public }) {
    const { rows } = await pool.query(
      `INSERT INTO compendium.collections (created_by, name, description, is_public)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, name, description ?? null, is_public ?? false]
    );
    return rows[0];
  },

  async update(id, userId, { name, description, is_public }, isAdmin = false) {
    const { rows } = await pool.query(
      `UPDATE compendium.collections
       SET name = $3, description = $4, is_public = $5, updated_at = NOW()
       WHERE id = $1 AND (created_by = $2 OR $6 = true)
       RETURNING *`,
      [id, userId, name, description ?? null, is_public ?? false, isAdmin]
    );
    return rows[0] || null;
  },

  async delete(id, userId, isAdmin = false) {
    const { rowCount } = await pool.query(
      `DELETE FROM compendium.collections WHERE id = $1 AND (created_by = $2 OR $3 = true)`,
      [id, userId, isAdmin]
    );
    return rowCount > 0;
  },

  // Only the collection owner (or admin) can add entries, and only entries
  // they can see (own or public, or anything if admin) — mirrors the
  // equipment collections' addItem visibility guard.
  async addItem(collectionId, userId, entryId, isAdmin = false) {
    const owns = await pool.query(
      `SELECT 1 FROM compendium.collections WHERE id = $1 AND (created_by = $2 OR $3 = true)`,
      [collectionId, userId, isAdmin]
    );
    if (!owns.rows.length) return null;

    const visible = await pool.query(
      `SELECT 1 FROM compendium.compendium_entries WHERE id = $1 AND ($3::bool OR created_by = $2 OR is_public = true)`,
      [entryId, userId, isAdmin]
    );
    if (!visible.rows.length) return null;

    const { rows } = await pool.query(
      `INSERT INTO compendium.collection_items (collection_id, entry_id)
       VALUES ($1, $2)
       ON CONFLICT (collection_id, entry_id) DO NOTHING
       RETURNING *`,
      [collectionId, entryId]
    );
    return rows[0] || { collection_id: collectionId, entry_id: entryId };
  },

  async removeItem(collectionId, userId, entryId, isAdmin = false) {
    const { rowCount } = await pool.query(
      `DELETE FROM compendium.collection_items ci
       USING compendium.collections c
       WHERE ci.collection_id = c.id AND c.id = $1 AND (c.created_by = $2 OR $4 = true) AND ci.entry_id = $3`,
      [collectionId, userId, entryId, isAdmin]
    );
    return rowCount > 0;
  },
};

module.exports = CollectionModel;
