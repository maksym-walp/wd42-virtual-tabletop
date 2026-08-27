const pool = require('../config/db');

const CalendarWeekdayModel = {
  async findAllByCalendar(calendarId) {
    const { rows } = await pool.query(
      `SELECT * FROM calendar.calendar_weekdays WHERE calendar_id = $1 ORDER BY order_num ASC`,
      [calendarId]
    );
    return rows;
  },

  async create(calendarId, data) {
    const { name, order_num } = data;
    const { rows } = await pool.query(
      `INSERT INTO calendar.calendar_weekdays (calendar_id, name, order_num)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [calendarId, name, order_num]
    );
    return rows[0];
  },

  async update(id, calendarId, data) {
    const { name, order_num } = data;
    const { rows } = await pool.query(
      `UPDATE calendar.calendar_weekdays
       SET name=$3, order_num=$4, updated_at=NOW()
       WHERE id=$1 AND calendar_id=$2
       RETURNING *`,
      [id, calendarId, name, order_num]
    );
    return rows[0] || null;
  },

  async delete(id, calendarId) {
    const { rowCount } = await pool.query(
      `DELETE FROM calendar.calendar_weekdays WHERE id=$1 AND calendar_id=$2`,
      [id, calendarId]
    );
    return rowCount > 0;
  },
};

module.exports = CalendarWeekdayModel;
