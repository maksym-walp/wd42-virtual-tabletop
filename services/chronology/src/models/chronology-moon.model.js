const pool = require('../config/db');

const ChronologyMoonModel = {
  async findAllByCalendar(calendarId) {
    const { rows } = await pool.query(
      `SELECT * FROM chronology.calendar_moons WHERE calendar_id = $1 ORDER BY name ASC`,
      [calendarId]
    );
    return rows;
  },

  async create(calendarId, data) {
    const { name, cycle_length, shift, color } = data;
    const { rows } = await pool.query(
      `INSERT INTO chronology.calendar_moons (calendar_id, name, cycle_length, shift, color)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [calendarId, name, cycle_length, shift ?? 0, color]
    );
    return rows[0];
  },

  async update(id, calendarId, data) {
    const { name, cycle_length, shift, color } = data;
    const { rows } = await pool.query(
      `UPDATE chronology.calendar_moons
       SET name=$3, cycle_length=$4, shift=$5, color=$6, updated_at=NOW()
       WHERE id=$1 AND calendar_id=$2
       RETURNING *`,
      [id, calendarId, name, cycle_length, shift ?? 0, color]
    );
    return rows[0] || null;
  },

  async delete(id, calendarId) {
    const { rowCount } = await pool.query(
      `DELETE FROM chronology.calendar_moons WHERE id=$1 AND calendar_id=$2`,
      [id, calendarId]
    );
    return rowCount > 0;
  },
};

module.exports = ChronologyMoonModel;
