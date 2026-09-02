const pool = require('../config/db');

// value 0..12; progress circles 0..4 (4 + the "+1" action raise a level).
const clampValue = (v) => Math.max(0, Math.min(12, v));
const clampMarks = (m) => Math.max(0, Math.min(4, m));

const SkillModel = {
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT * FROM character_sheet.skills
       WHERE character_id = $1
       ORDER BY skill_key`,
      [characterId]
    );
    return rows;
  },

  async findByKey(characterId, skillKey) {
    const { rows } = await pool.query(
      `SELECT * FROM character_sheet.skills
       WHERE character_id = $1 AND skill_key = $2`,
      [characterId, skillKey]
    );
    return rows[0] || null;
  },

  // Patch value / progress_marks / base_value for a single skill.
  // base_value is only ever sent by the character-creation wizard.
  async patch(characterId, skillKey, { value, progress_marks, base_value }) {
    const sets = [];
    const params = [characterId, skillKey];

    if (value !== undefined) {
      params.push(clampValue(value));
      sets.push(`value = $${params.length}`);
    }
    if (progress_marks !== undefined) {
      params.push(clampMarks(progress_marks));
      sets.push(`progress_marks = $${params.length}`);
    }
    if (base_value !== undefined) {
      params.push(clampValue(base_value));
      sets.push(`base_value = $${params.length}`);
    }
    if (!sets.length) return this.findByKey(characterId, skillKey);

    const { rows } = await pool.query(
      `UPDATE character_sheet.skills
       SET ${sets.join(', ')}
       WHERE character_id = $1 AND skill_key = $2
       RETURNING *`,
      params
    );
    return rows[0] || null;
  },

  // Bulk update: [{skill_key, value, progress_marks, base_value}]
  async bulkUpdate(characterId, updates) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];
      for (const { skill_key, value, progress_marks, base_value } of updates) {
        const { rows } = await client.query(
          `UPDATE character_sheet.skills
           SET value = COALESCE($3, value),
               progress_marks = COALESCE($4, progress_marks),
               base_value = COALESCE($5, base_value)
           WHERE character_id = $1 AND skill_key = $2
           RETURNING *`,
          [
            characterId, skill_key,
            value === undefined || value === null ? null : clampValue(value),
            progress_marks === undefined || progress_marks === null ? null : clampMarks(progress_marks),
            base_value === undefined || base_value === null ? null : clampValue(base_value),
          ]
        );
        if (rows[0]) results.push(rows[0]);
      }
      await client.query('COMMIT');
      return results;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = SkillModel;
