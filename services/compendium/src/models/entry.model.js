const pool = require('../config/db');

// An entry's health die comes from its subspecies (if set), else its species
// (if set), else a d6 fallback for entries with neither — never chosen on
// the entry itself. Every read resolves it via this LEFT JOIN.
const HEALTH_DIE_SELECT = `COALESCE(sub.health_die, sp.health_die, 'd6') AS health_die`;
const HEALTH_DIE_JOIN = `
       LEFT JOIN compendium.species sp ON sp.id = e.species_id
       LEFT JOIN compendium.subspecies sub ON sub.id = e.subspecies_id`;

const EntryModel = {
  async create({ createdBy, entityType, name, speciesId, subspeciesId, description, history, imageUrl,
                 motivation, backstory, faction, attributes, isPublic }) {
    const { rows } = await pool.query(
      `WITH inserted AS (
         INSERT INTO compendium.compendium_entries
           (entity_type, created_by, name, species_id, subspecies_id, description, history, image_url,
            motivation, backstory, faction, dexterity, body, intelligence, wisdom, charisma, is_public)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING *
       )
       SELECT e.*, ${HEALTH_DIE_SELECT}
       FROM inserted e${HEALTH_DIE_JOIN}`,
      [entityType, createdBy, name, speciesId ?? null, subspeciesId ?? null, description ?? null, history ?? null,
       imageUrl ?? null, motivation ?? null, backstory ?? null, faction ?? null,
       attributes.dexterity, attributes.body, attributes.intelligence, attributes.wisdom, attributes.charisma,
       isPublic ?? false]
    );
    return rows[0];
  },

  async findAll(userId, isAdmin, entityType) {
    const params = [userId, isAdmin];
    const conditions = ['($2::bool OR e.created_by = $1 OR e.is_public = true)'];
    if (entityType) {
      params.push(entityType);
      conditions.push(`e.entity_type = $${params.length}`);
    }
    const { rows } = await pool.query(
      `SELECT e.*, (e.created_by = $1) AS is_owner, ${HEALTH_DIE_SELECT}
       FROM compendium.compendium_entries e${HEALTH_DIE_JOIN}
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.name ASC`,
      params
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT e.*, (e.created_by = $2) AS is_owner, ${HEALTH_DIE_SELECT}
       FROM compendium.compendium_entries e${HEALTH_DIE_JOIN}
       WHERE e.id = $1`,
      [id, userId]
    );
    return rows[0] || null;
  },

  // entity_type is fixed at creation — never part of the update column set.
  async update(id, { name, speciesId, subspeciesId, description, history, imageUrl,
                      motivation, backstory, faction, attributes, isPublic }) {
    const { rows } = await pool.query(
      `WITH updated AS (
         UPDATE compendium.compendium_entries
         SET name = $2, species_id = $3, subspecies_id = $4, description = $5, history = $6, image_url = $7,
             motivation = $8, backstory = $9, faction = $10, dexterity = $11, body = $12, intelligence = $13,
             wisdom = $14, charisma = $15, is_public = $16, updated_at = NOW()
         WHERE id = $1
         RETURNING *
       )
       SELECT e.*, ${HEALTH_DIE_SELECT}
       FROM updated e${HEALTH_DIE_JOIN}`,
      [id, name, speciesId ?? null, subspeciesId ?? null, description ?? null, history ?? null, imageUrl ?? null,
       motivation ?? null, backstory ?? null, faction ?? null,
       attributes.dexterity, attributes.body, attributes.intelligence, attributes.wisdom, attributes.charisma,
       isPublic ?? false]
    );
    return rows[0] || null;
  },

  // Narrow, dedicated update: persists a rolled health total without
  // touching any other field (unlike `update`, which rewrites the whole
  // row from a full form submission) — so rolling health survives
  // unrelated edits and vice versa.
  async updateRolledHealth(id, rolledHealth) {
    const { rows } = await pool.query(
      `WITH updated AS (
         UPDATE compendium.compendium_entries
         SET rolled_health = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING *
       )
       SELECT e.*, ${HEALTH_DIE_SELECT}
       FROM updated e${HEALTH_DIE_JOIN}`,
      [id, rolledHealth]
    );
    return rows[0] || null;
  },

  async remove(id) {
    const { rowCount } = await pool.query(`DELETE FROM compendium.compendium_entries WHERE id = $1`, [id]);
    return rowCount > 0;
  },
};

module.exports = EntryModel;
