const pool = require('../config/db');

const ChronologyWeekdayModel = {
  async findAllByCalendar(calendarId) {
    const { rows } = await pool.query(
      `SELECT * FROM chronology.calendar_weekdays WHERE calendar_id = $1 ORDER BY order_num ASC`,
      [calendarId]
    );
    return rows;
  },

  async create(calendarId, data) {
    const { name, short_name, order_num } = data;
    const { rows } = await pool.query(
      `INSERT INTO chronology.calendar_weekdays (calendar_id, name, short_name, order_num)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [calendarId, name, short_name || null, order_num]
    );
    return rows[0];
  },

  async update(id, calendarId, data) {
    const { name, short_name, order_num } = data;
    const { rows } = await pool.query(
      `UPDATE chronology.calendar_weekdays
       SET name=$3, short_name=$4, order_num=$5, updated_at=NOW()
       WHERE id=$1 AND calendar_id=$2
       RETURNING *`,
      [id, calendarId, name, short_name || null, order_num]
    );
    return rows[0] || null;
  },

  async delete(id, calendarId) {
    const { rowCount } = await pool.query(
      `DELETE FROM chronology.calendar_weekdays WHERE id=$1 AND calendar_id=$2`,
      [id, calendarId]
    );
    return rowCount > 0;
  },
};

module.exports = ChronologyWeekdayModel;
