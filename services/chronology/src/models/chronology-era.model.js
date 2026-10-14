const pool = require('../config/db');

const ChronologyEraModel = {
  // У хронологічному порядку початку (рік → порядок місяця → день).
  async findAllByCalendar(calendarId) {
    const { rows } = await pool.query(
      `SELECT e.*, m.name AS start_month_name
       FROM chronology.calendar_eras e
       JOIN chronology.calendar_months m ON m.id = e.start_month_id
       WHERE e.calendar_id = $1
       ORDER BY e.start_year ASC, m.order_num ASC, e.start_day ASC`,
      [calendarId]
    );
    return rows;
  },

  // Довжина місяця, якщо він належить цьому календарю, інакше null — одним
  // запитом і перевірка належності, і межа для start_day.
  async monthLengthInCalendar(monthId, calendarId) {
    const { rows } = await pool.query(
      `SELECT length FROM chronology.calendar_months WHERE id = $1 AND calendar_id = $2 LIMIT 1`,
      [monthId, calendarId]
    );
    return rows[0] ? Number(rows[0].length) : null;
  },

  async create(calendarId, data) {
    const { name, start_year, start_month_id, start_day, cycle_years } = data;
    const { rows } = await pool.query(
      `INSERT INTO chronology.calendar_eras (calendar_id, name, start_year, start_month_id, start_day, cycle_years)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [calendarId, name, start_year, start_month_id, start_day, cycle_years ?? null]
    );
    return rows[0];
  },

  async update(id, calendarId, data) {
    const { name, start_year, start_month_id, start_day, cycle_years } = data;
    const { rows } = await pool.query(
      `UPDATE chronology.calendar_eras
       SET name=$3, start_year=$4, start_month_id=$5, start_day=$6, cycle_years=$7, updated_at=NOW()
       WHERE id=$1 AND calendar_id=$2
       RETURNING *`,
      [id, calendarId, name, start_year, start_month_id, start_day, cycle_years ?? null]
    );
    return rows[0] || null;
  },

  async delete(id, calendarId) {
    const { rowCount } = await pool.query(
      `DELETE FROM chronology.calendar_eras WHERE id=$1 AND calendar_id=$2`,
      [id, calendarId]
    );
    return rowCount > 0;
  },
};

module.exports = ChronologyEraModel;
