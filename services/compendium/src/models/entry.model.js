const pool = require('../config/db');

// An entry's health die is, in order: its own explicit override (NPCs may
// set one), else its subspecies' die, else its species' die, else a d6
// fallback. Every read resolves it via this LEFT JOIN.
const HEALTH_DIE_SELECT = `COALESCE(e.health_die_override, sub.health_die, sp.health_die, 'd6') AS health_die`;
const HEALTH_DIE_JOIN = `
       LEFT JOIN compendium.species sp ON sp.id = e.species_id
       LEFT JOIN compendium.subspecies sub ON sub.id = e.subspecies_id`;

const EntryModel = {
  async create({ createdBy, entityType, name, speciesId, subspeciesId, raceId, peopleId, description, history,
                 imageUrl, motivation, backstory, faction, attributes, isPublic,
                 age, gender, birthCalendarId, birthYear, birthMonthId, birthDay,
                 healthDieOverride, privateNotes }) {
    const { rows } = await pool.query(
      `WITH inserted AS (
         INSERT INTO compendium.compendium_entries
           (entity_type, created_by, name, species_id, subspecies_id, race_id, people_id, description, history,
            image_url, motivation, backstory, faction, dexterity, body, intelligence, wisdom, charisma, is_public,
            age, gender, birth_calendar_id, birth_year, birth_month_id, birth_day,
            health_die_override, private_notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
                 $20, $21, $22, $23, $24, $25, $26, $27)
         RETURNING *
       )
       SELECT e.*, ${HEALTH_DIE_SELECT}
       FROM inserted e${HEALTH_DIE_JOIN}`,
      [entityType, createdBy, name, speciesId ?? null, subspeciesId ?? null, raceId ?? null, peopleId ?? null,
       description ?? null, history ?? null, imageUrl ?? null, motivation ?? null, backstory ?? null, faction ?? null,
       attributes.dexterity, attributes.body, attributes.intelligence, attributes.wisdom, attributes.charisma,
       isPublic ?? false,
       age ?? null, gender ?? null, birthCalendarId ?? null, birthYear ?? null, birthMonthId ?? null, birthDay ?? null,
       healthDieOverride ?? null, privateNotes ?? null]
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
  async update(id, { name, speciesId, subspeciesId, raceId, peopleId, description, history, imageUrl,
                      motivation, backstory, faction, attributes, isPublic,
                      age, gender, birthCalendarId, birthYear, birthMonthId, birthDay,
                      healthDieOverride, privateNotes }) {
    const { rows } = await pool.query(
      `WITH updated AS (
         UPDATE compendium.compendium_entries
         SET name = $2, species_id = $3, subspecies_id = $4, race_id = $5, people_id = $6, description = $7,
             history = $8, image_url = $9, motivation = $10, backstory = $11, faction = $12,
             dexterity = $13, body = $14, intelligence = $15, wisdom = $16, charisma = $17, is_public = $18,
             age = $19, gender = $20, birth_calendar_id = $21, birth_year = $22, birth_month_id = $23, birth_day = $24,
             health_die_override = $25, private_notes = $26,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *
       )
       SELECT e.*, ${HEALTH_DIE_SELECT}
       FROM updated e${HEALTH_DIE_JOIN}`,
      [id, name, speciesId ?? null, subspeciesId ?? null, raceId ?? null, peopleId ?? null,
       description ?? null, history ?? null, imageUrl ?? null, motivation ?? null, backstory ?? null, faction ?? null,
       attributes.dexterity, attributes.body, attributes.intelligence, attributes.wisdom, attributes.charisma,
       isPublic ?? false,
       age ?? null, gender ?? null, birthCalendarId ?? null, birthYear ?? null, birthMonthId ?? null, birthDay ?? null,
       healthDieOverride ?? null, privateNotes ?? null]
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

  async setOwner(id, ownerUsername) {
    const { rows } = await pool.query(
      `UPDATE compendium.compendium_entries
       SET created_by = (SELECT id FROM auth.users WHERE username = $2), updated_at = NOW()
       WHERE id = $1 AND EXISTS (SELECT 1 FROM auth.users WHERE username = $2)
       RETURNING *`,
      [id, ownerUsername]
    );
    return rows[0] || null;
  },
};

module.exports = EntryModel;
