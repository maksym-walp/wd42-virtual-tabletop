const pool = require('../config/db');

const RitualTrackerModel = {
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT * FROM character_sheet.ritual_trackers
       WHERE character_id = $1
       ORDER BY created_at ASC`,
      [characterId]
    );
    return rows;
  },

  async create(characterId, { name, rounds, participants }) {
    const { rows } = await pool.query(
      `INSERT INTO character_sheet.ritual_trackers (character_id, name, rounds, participants)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING *`,
      [characterId, name, rounds ?? 3, JSON.stringify(participants ?? [])]
    );
    return rows[0];
  },

  async update(characterId, trackerId, { name, rounds, participants }) {
    const { rows } = await pool.query(
      `UPDATE character_sheet.ritual_trackers
       SET name         = COALESCE($3, name),
           rounds       = COALESCE($4, rounds),
           participants = COALESCE($5::jsonb, participants)
       WHERE id = $1 AND character_id = $2
       RETURNING *`,
      [
        trackerId, characterId,
        name ?? null, rounds ?? null,
        participants ? JSON.stringify(participants) : null,
      ]
    );
    return rows[0] || null;
  },

  async delete(characterId, trackerId) {
    const { rowCount } = await pool.query(
      `DELETE FROM character_sheet.ritual_trackers WHERE id = $1 AND character_id = $2`,
      [trackerId, characterId]
    );
    return rowCount > 0;
  },
};

module.exports = RitualTrackerModel;
