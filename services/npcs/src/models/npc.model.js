const pool = require('../config/db');
const { serializeImageCrop } = require('../utils/image-crop');

// An NPC's health die is, in order: its own explicit override, else its
// subspecies' die, else its species' die, else a d6 fallback. species/
// subspecies live in the compendium service's schema — read cross-schema.
const HEALTH_DIE_SELECT = `COALESCE(n.health_die_override, sub.health_die, sp.health_die, 'd6') AS health_die`;
const HEALTH_DIE_JOIN = `
       LEFT JOIN compendium.species sp ON sp.id = n.species_id
       LEFT JOIN compendium.subspecies sub ON sub.id = n.subspecies_id`;

// Column order for create/update; values() below must match it.
const COLUMNS = ['name', 'species_id', 'subspecies_id', 'race_id', 'people_id', 'description', 'motivation',
  'backstory', 'image_url', 'dexterity', 'body', 'intelligence', 'wisdom', 'charisma', 'health_die_override',
  'age', 'gender', 'birth_calendar_id', 'birth_year', 'birth_month_id', 'birth_day',
  'death_calendar_id', 'death_year', 'death_month_id', 'death_day', 'private_notes', 'is_public'];

function values(fields) {
  const { attributes } = fields;
  return [
    fields.name, fields.speciesId ?? null, fields.subspeciesId ?? null, fields.raceId ?? null, fields.peopleId ?? null,
    fields.description ?? null, fields.motivation ?? null, fields.backstory ?? null, fields.imageUrl ?? null,
    attributes.dexterity, attributes.body, attributes.intelligence, attributes.wisdom, attributes.charisma,
    fields.healthDieOverride ?? null, fields.age ?? null, fields.gender ?? null,
    fields.birthCalendarId ?? null, fields.birthYear ?? null, fields.birthMonthId ?? null, fields.birthDay ?? null,
    fields.deathCalendarId ?? null, fields.deathYear ?? null, fields.deathMonthId ?? null, fields.deathDay ?? null,
    fields.privateNotes ?? null, fields.isPublic ?? false,
    serializeImageCrop(fields.imageUrl ? fields.imageCrop : null),
  ];
}

const NpcModel = {
  async create({ createdBy, ...fields }) {
    const placeholders = COLUMNS.map((_, i) => `$${i + 2}`).join(', ');
    const { rows } = await pool.query(
      `WITH inserted AS (
         INSERT INTO npcs.npcs (created_by, ${COLUMNS.join(', ')}, image_crop)
         VALUES ($1, ${placeholders}, $${COLUMNS.length + 2}::jsonb)
         RETURNING *
       )
       SELECT n.*, ${HEALTH_DIE_SELECT}
       FROM inserted n${HEALTH_DIE_JOIN}`,
      [createdBy, ...values(fields)]
    );
    return rows[0];
  },

  async findAll(userId, isAdmin) {
    const { rows } = await pool.query(
      `SELECT n.*, (n.created_by = $1) AS is_owner, ${HEALTH_DIE_SELECT}
       FROM npcs.npcs n${HEALTH_DIE_JOIN}
       WHERE ($2::bool OR n.created_by = $1 OR n.is_public = true)
       ORDER BY n.name ASC`,
      [userId, isAdmin]
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT n.*, (n.created_by = $2) AS is_owner, ${HEALTH_DIE_SELECT}
       FROM npcs.npcs n${HEALTH_DIE_JOIN}
       WHERE n.id = $1`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async update(id, fields) {
    const assignments = COLUMNS.map((col, i) => `${col} = $${i + 2}`).join(', ');
    const { rows } = await pool.query(
      `WITH updated AS (
         UPDATE npcs.npcs
         SET ${assignments}, image_crop = $${COLUMNS.length + 2}::jsonb, updated_at = NOW()
         WHERE id = $1
         RETURNING *
       )
       SELECT n.*, ${HEALTH_DIE_SELECT}
       FROM updated n${HEALTH_DIE_JOIN}`,
      [id, ...values(fields)]
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
         UPDATE npcs.npcs
         SET rolled_health = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING *
       )
       SELECT n.*, ${HEALTH_DIE_SELECT}
       FROM updated n${HEALTH_DIE_JOIN}`,
      [id, rolledHealth]
    );
    return rows[0] || null;
  },

  // faction_members / npc_relationships point at NPCs polymorphically (no FK),
  // so rows where this NPC is the member/target go in the same statement.
  async remove(id) {
    const { rowCount } = await pool.query(
      `WITH members AS (
         DELETE FROM npcs.faction_members WHERE member_type = 'npc' AND member_id = $1
       ), relationships AS (
         DELETE FROM npcs.npc_relationships WHERE target_type = 'npc' AND target_id = $1
       )
       DELETE FROM npcs.npcs WHERE id = $1`,
      [id]
    );
    return rowCount > 0;
  },

  async setOwner(id, ownerUsername) {
    const { rows } = await pool.query(
      `UPDATE npcs.npcs
       SET created_by = (SELECT id FROM auth.users WHERE username = $2), updated_at = NOW()
       WHERE id = $1 AND EXISTS (SELECT 1 FROM auth.users WHERE username = $2)
       RETURNING *`,
      [id, ownerUsername]
    );
    return rows[0] || null;
  },
};

module.exports = NpcModel;
