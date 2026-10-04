const pool = require('../config/db');
const { serializeImageCrop } = require('../utils/image-crop');

// A creature's health die is, in order: its own explicit override, else its
// subspecies' die, else its species' die, else a d6 fallback. species/
// subspecies live in the compendium service's schema — read cross-schema,
// same convention as the equipment/spellbook joins in relations.model.js.
const HEALTH_DIE_SELECT = `COALESCE(c.health_die_override, sub.health_die, sp.health_die, 'd6') AS health_die`;
const HEALTH_DIE_JOIN = `
       LEFT JOIN compendium.species sp ON sp.id = c.species_id
       LEFT JOIN compendium.subspecies sub ON sub.id = c.subspecies_id`;

const COLUMNS = ['name', 'species_id', 'subspecies_id', 'race_id', 'people_id', 'description', 'history',
  'image_url', 'dexterity', 'body', 'intelligence', 'wisdom', 'charisma', 'health_die_override', 'is_public'];

function values(fields) {
  const { attributes } = fields;
  return [
    fields.name, fields.speciesId ?? null, fields.subspeciesId ?? null, fields.raceId ?? null, fields.peopleId ?? null,
    fields.description ?? null, fields.history ?? null, fields.imageUrl ?? null,
    attributes.dexterity, attributes.body, attributes.intelligence, attributes.wisdom, attributes.charisma,
    fields.healthDieOverride ?? null, fields.isPublic ?? false,
    serializeImageCrop(fields.imageUrl ? fields.imageCrop : null),
  ];
}

const CreatureModel = {
  async create({ createdBy, ...fields }) {
    const placeholders = COLUMNS.map((_, i) => `$${i + 2}`).join(', ');
    const { rows } = await pool.query(
      `WITH inserted AS (
         INSERT INTO bestiary.creatures (created_by, ${COLUMNS.join(', ')}, image_crop)
         VALUES ($1, ${placeholders}, $${COLUMNS.length + 2}::jsonb)
         RETURNING *
       )
       SELECT c.*, ${HEALTH_DIE_SELECT}
       FROM inserted c${HEALTH_DIE_JOIN}`,
      [createdBy, ...values(fields)]
    );
    return rows[0];
  },

  async findAll(userId, isAdmin) {
    const { rows } = await pool.query(
      `SELECT c.*, (c.created_by = $1) AS is_owner, ${HEALTH_DIE_SELECT}
       FROM bestiary.creatures c${HEALTH_DIE_JOIN}
       WHERE ($2::bool OR c.created_by = $1 OR c.is_public = true)
       ORDER BY c.name ASC`,
      [userId, isAdmin]
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT c.*, (c.created_by = $2) AS is_owner, ${HEALTH_DIE_SELECT}
       FROM bestiary.creatures c${HEALTH_DIE_JOIN}
       WHERE c.id = $1`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async update(id, fields) {
    const assignments = COLUMNS.map((col, i) => `${col} = $${i + 2}`).join(', ');
    const { rows } = await pool.query(
      `WITH updated AS (
         UPDATE bestiary.creatures
         SET ${assignments}, image_crop = $${COLUMNS.length + 2}::jsonb, updated_at = NOW()
         WHERE id = $1
         RETURNING *
       )
       SELECT c.*, ${HEALTH_DIE_SELECT}
       FROM updated c${HEALTH_DIE_JOIN}`,
      [id, ...values(fields)]
    );
    return rows[0] || null;
  },

  async remove(id) {
    const { rowCount } = await pool.query(`DELETE FROM bestiary.creatures WHERE id = $1`, [id]);
    return rowCount > 0;
  },

  async setOwner(id, ownerUsername) {
    const { rows } = await pool.query(
      `UPDATE bestiary.creatures
       SET created_by = (SELECT id FROM auth.users WHERE username = $2), updated_at = NOW()
       WHERE id = $1 AND EXISTS (SELECT 1 FROM auth.users WHERE username = $2)
       RETURNING *`,
      [id, ownerUsername]
    );
    return rows[0] || null;
  },
};

module.exports = CreatureModel;
