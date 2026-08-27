const pool = require('../config/db');

const CalendarMonthModel = {
  async findAllByCalendar(calendarId) {
    const { rows } = await pool.query(
      `SELECT * FROM calendar.calendar_months WHERE calendar_id = $1 ORDER BY order_num ASC`,
      [calendarId]
    );
    return rows;
  },

  async create(calendarId, data) {
    const { name, length, order_num } = data;
    const { rows } = await pool.query(
      `INSERT INTO calendar.calendar_months (calendar_id, name, length, order_num)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [calendarId, name, length, order_num]
    );
    return rows[0];
  },

  async update(id, calendarId, data) {
    const { name, length, order_num } = data;
    const { rows } = await pool.query(
      `UPDATE calendar.calendar_months
       SET name=$3, length=$4, order_num=$5, updated_at=NOW()
       WHERE id=$1 AND calendar_id=$2
       RETURNING *`,
      [id, calendarId, name, length, order_num]
    );
    return rows[0] || null;
  },

  async delete(id, calendarId) {
    const { rowCount } = await pool.query(
      `DELETE FROM calendar.calendar_months WHERE id=$1 AND calendar_id=$2`,
      [id, calendarId]
    );
    return rowCount > 0;
  },
};

module.exports = CalendarMonthModel;
