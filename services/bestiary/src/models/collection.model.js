const pool = require('../config/db');
const { serializeImageCrop } = require('../utils/image-crop');

// GM-curated named bundles of one record type. Both stat-block services
// (bestiary: creatures, npcs: NPCs) keep the same collections shape, so the
// model is built per service from fixed literals: the schema, the record
// table, and the item FK column on collection_items.
function createCollectionModel({ schema, recordTable, itemColumn }) {
  const entryFields = `jsonb_build_object(
      'id', e.id, 'name', e.name,
      'description', e.description, 'is_public', e.is_public, 'image_url', e.image_url,
      'image_crop', e.image_crop
    )`;

  const itemsSelect = `COALESCE(
      (SELECT jsonb_agg(${entryFields} ORDER BY e.name)
       FROM ${schema}.collection_items ci
       JOIN ${recordTable} e ON e.id = ci.${itemColumn}
       WHERE ci.collection_id = c.id),
      '[]'::jsonb
    ) AS items`;

  return {
    async findAll(userId, { search } = {}, isAdmin = false) {
      const params = [userId];
      const conditions = [isAdmin ? 'TRUE' : '(c.created_by = $1 OR c.is_public = true)'];
      if (search) {
        params.push(`%${search}%`);
        conditions.push(`c.name ILIKE $${params.length}`);
      }
      const { rows } = await pool.query(
        `SELECT c.*, (c.created_by = $1) AS is_owner, ou.username AS owner_username, ${itemsSelect}
         FROM ${schema}.collections c
         LEFT JOIN auth.users ou ON ou.id = c.created_by
         WHERE ${conditions.join(' AND ')}
         ORDER BY c.name ASC`,
        params
      );
      return rows;
    },

    async findById(id, userId, isAdmin = false) {
      const visibility = isAdmin ? 'TRUE' : '(c.created_by = $2 OR c.is_public = true)';
      const { rows } = await pool.query(
        `SELECT c.*, (c.created_by = $2) AS is_owner, ou.username AS owner_username, ${itemsSelect}
         FROM ${schema}.collections c
         LEFT JOIN auth.users ou ON ou.id = c.created_by
         WHERE c.id = $1 AND ${visibility}`,
        [id, userId]
      );
      return rows[0] || null;
    },

    async findPublicById(id) {
      const { rows } = await pool.query(
        `SELECT c.*, false AS is_owner, ou.username AS owner_username, ${itemsSelect}
         FROM ${schema}.collections c
         LEFT JOIN auth.users ou ON ou.id = c.created_by
         WHERE c.id = $1 AND c.is_public = true`,
        [id]
      );
      return rows[0] || null;
    },

    async create(userId, { name, description, is_public, image_url, image_crop }) {
      const { rows } = await pool.query(
        `INSERT INTO ${schema}.collections (created_by, name, description, is_public, image_url, image_crop)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING *`,
        [userId, name, description ?? null, is_public ?? false, image_url ?? null, serializeImageCrop(image_url ? image_crop : null)]
      );
      return rows[0];
    },

    async update(id, userId, { name, description, is_public, image_url, image_crop }, isAdmin = false) {
      const { rows } = await pool.query(
        `UPDATE ${schema}.collections
         SET name = $3, description = $4, is_public = $5, image_url = $6, image_crop = $8::jsonb, updated_at = NOW()
         WHERE id = $1 AND (created_by = $2 OR $7 = true)
         RETURNING *`,
        [id, userId, name, description ?? null, is_public ?? false, image_url ?? null, isAdmin,
          serializeImageCrop(image_url ? image_crop : null)]
      );
      return rows[0] || null;
    },

    async delete(id, userId, isAdmin = false) {
      const { rowCount } = await pool.query(
        `DELETE FROM ${schema}.collections WHERE id = $1 AND (created_by = $2 OR $3 = true)`,
        [id, userId, isAdmin]
      );
      return rowCount > 0;
    },

    // Only the collection owner (or admin) can add entries, and only entries
    // they can see (own or public, or anything if admin) — mirrors the
    // equipment collections' addItem visibility guard.
    async addItem(collectionId, userId, entryId, isAdmin = false) {
      const owns = await pool.query(
        `SELECT 1 FROM ${schema}.collections WHERE id = $1 AND (created_by = $2 OR $3 = true)`,
        [collectionId, userId, isAdmin]
      );
      if (!owns.rows.length) return null;

      const visible = await pool.query(
        `SELECT 1 FROM ${recordTable} WHERE id = $1 AND ($3::bool OR created_by = $2 OR is_public = true)`,
        [entryId, userId, isAdmin]
      );
      if (!visible.rows.length) return null;

      const { rows } = await pool.query(
        `INSERT INTO ${schema}.collection_items (collection_id, ${itemColumn})
         VALUES ($1, $2)
         ON CONFLICT (collection_id, ${itemColumn}) DO NOTHING
         RETURNING *`,
        [collectionId, entryId]
      );
      return rows[0] || { collection_id: collectionId, [itemColumn]: entryId };
    },

    async removeItem(collectionId, userId, entryId, isAdmin = false) {
      const { rowCount } = await pool.query(
        `DELETE FROM ${schema}.collection_items ci
         USING ${schema}.collections c
         WHERE ci.collection_id = c.id AND c.id = $1 AND (c.created_by = $2 OR $4 = true) AND ci.${itemColumn} = $3`,
        [collectionId, userId, entryId, isAdmin]
      );
      return rowCount > 0;
    },

    async setOwner(id, ownerUsername) {
      const { rows } = await pool.query(
        `UPDATE ${schema}.collections
         SET created_by = (SELECT id FROM auth.users WHERE username = $2), updated_at = NOW()
         WHERE id = $1 AND EXISTS (SELECT 1 FROM auth.users WHERE username = $2)
         RETURNING *`,
        [id, ownerUsername]
      );
      return rows[0] || null;
    },
  };
}

module.exports = createCollectionModel({ schema: 'bestiary', recordTable: 'bestiary.creatures', itemColumn: 'creature_id' });
module.exports.createCollectionModel = createCollectionModel;
