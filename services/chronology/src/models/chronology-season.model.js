const pool = require('../config/db');

const ChronologySeasonModel = {
  async findAllByCalendar(calendarId) {
    const { rows } = await pool.query(
      `SELECT s.*, m.name AS start_month_name
       FROM chronology.calendar_seasons s
       JOIN chronology.calendar_months m ON m.id = s.start_month_id
       WHERE s.calendar_id = $1
       ORDER BY m.order_num ASC, s.start_day ASC`,
      [calendarId]
    );
    return rows;
  },

  // start_month_id must belong to the same calendar — checked here rather
  // than via FK alone, since the FK only guarantees the month exists
  // somewhere, not that it's one of this calendar's own months.
  async monthBelongsToCalendar(monthId, calendarId) {
    const { rows } = await pool.query(
      `SELECT 1 FROM chronology.calendar_months WHERE id = $1 AND calendar_id = $2 LIMIT 1`,
      [monthId, calendarId]
    );
    return rows.length > 0;
  },

  async create(calendarId, data) {
    const { name, start_month_id, start_day, color, bg_image_url } = data;
    const { rows } = await pool.query(
      `INSERT INTO chronology.calendar_seasons (calendar_id, name, start_month_id, start_day, color, bg_image_url)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [calendarId, name, start_month_id, start_day, color, bg_image_url ?? null]
    );
    return rows[0];
  },

  async update(id, calendarId, data) {
    const { name, start_month_id, start_day, color, bg_image_url } = data;
    const { rows } = await pool.query(
      `UPDATE chronology.calendar_seasons
       SET name=$3, start_month_id=$4, start_day=$5, color=$6, bg_image_url=$7, updated_at=NOW()
       WHERE id=$1 AND calendar_id=$2
       RETURNING *`,
      [id, calendarId, name, start_month_id, start_day, color, bg_image_url ?? null]
    );
    return rows[0] || null;
  },

  async delete(id, calendarId) {
    const { rowCount } = await pool.query(
      `DELETE FROM chronology.calendar_seasons WHERE id=$1 AND calendar_id=$2`,
      [id, calendarId]
    );
    return rowCount > 0;
  },
};

module.exports = ChronologySeasonModel;
