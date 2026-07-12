const pool = require('../config/db');

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

  // Patch value and/or progress_marks for a single skill
  async patch(characterId, skillKey, { value, progress_marks }) {
    const sets = [];
    const params = [characterId, skillKey];

    if (value !== undefined) {
      params.push(value);
      sets.push(`value = $${params.length}`);
    }
    if (progress_marks !== undefined) {
      params.push(progress_marks);
      sets.push(`progress_marks = $${params.length}`);
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

  // Bulk update: [{skill_key, value, progress_marks}]
  async bulkUpdate(characterId, updates) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];
      for (const { skill_key, value, progress_marks } of updates) {
        const { rows } = await client.query(
          `UPDATE character_sheet.skills
           SET value = COALESCE($3, value),
               progress_marks = COALESCE($4, progress_marks)
           WHERE character_id = $1 AND skill_key = $2
           RETURNING *`,
          [characterId, skill_key, value ?? null, progress_marks ?? null]
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
