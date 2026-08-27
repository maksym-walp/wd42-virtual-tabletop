const pool = require('../config/db');

const CalendarModel = {
  // Visible to the requester: public calendars, their own (any visibility),
  // or everything if admin. Mirrors maps.maps' owner+admin/public convention,
  // inverted for the is_private field this table uses instead of is_public.
  async findAll(userId, isAdmin = false) {
    const visibility = isAdmin ? 'TRUE' : '(c.is_private = false OR c.creator_id = $1)';
    const { rows } = await pool.query(
      `SELECT c.*, (c.creator_id = $1) AS is_owner
       FROM calendar.calendars c
       WHERE ${visibility}
       ORDER BY c.name ASC`,
      [userId]
    );
    return rows;
  },

  // Same visibility rule as findAll, single row, id-scoped.
  async findById(id, userId, isAdmin = false) {
    const visibility = isAdmin ? 'TRUE' : '(c.is_private = false OR c.creator_id = $2)';
    const { rows } = await pool.query(
      `SELECT c.*, (c.creator_id = $2) AS is_owner
       FROM calendar.calendars c
       WHERE c.id = $1 AND ${visibility}`,
      [id, userId]
    );
    return rows[0] || null;
  },

  // Existence check with no visibility filter, for write paths already
  // gated by requireCalendarManager (admin/game_master may manage any
  // calendar, not just their own).
  async findByIdRaw(id) {
    const { rows } = await pool.query(`SELECT * FROM calendar.calendars WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async create(creatorId, data) {
    const {
      name, description, current_era_name, previous_era_name,
      first_day_offset, is_private,
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO calendar.calendars
         (creator_id, name, description, current_era_name, previous_era_name, first_day_offset, is_private)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [creatorId, name, description ?? null, current_era_name ?? null, previous_era_name ?? null,
        first_day_offset ?? 0, is_private ?? false]
    );
    return rows[0];
  },

  async update(id, data) {
    const {
      name, description, current_era_name, previous_era_name,
      first_day_offset, is_private, default_year, default_month_id,
    } = data;

    const { rows } = await pool.query(
      `UPDATE calendar.calendars
       SET name=$2, description=$3, current_era_name=$4, previous_era_name=$5,
           first_day_offset=$6, is_private=$7, default_year=$8, default_month_id=$9, updated_at=NOW()
       WHERE id=$1
       RETURNING *`,
      [id, name, description ?? null, current_era_name ?? null, previous_era_name ?? null,
        first_day_offset ?? 0, is_private ?? false, default_year ?? null, default_month_id ?? null]
    );
    return rows[0] || null;
  },

  async delete(id) {
    const { rowCount } = await pool.query(`DELETE FROM calendar.calendars WHERE id = $1`, [id]);
    return rowCount > 0;
  },

  // default_month_id must belong to this same calendar — same guard as
  // calendar_seasons.start_month_id (see calendar-season.model.js).
  async monthBelongsToCalendar(monthId, calendarId) {
    const { rows } = await pool.query(
      `SELECT 1 FROM calendar.calendar_months WHERE id = $1 AND calendar_id = $2 LIMIT 1`,
      [monthId, calendarId]
    );
    return rows.length > 0;
  },
};

module.exports = CalendarModel;
