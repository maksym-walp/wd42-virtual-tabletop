const pool = require('../config/db');

const CalendarEventModel = {
  // campaignId omitted/null -> only global lore events (campaign_id IS NULL).
  // campaignId set -> global events PLUS that campaign's own events.
  // includePrivate -> managers (admin/game_master) see is_public=false
  // events too; regular users only ever see is_public=true ones.
  async findAllByCalendar(calendarId, { campaignId, includePrivate } = {}) {
    const params = [calendarId];
    let campaignFilter = 'campaign_id IS NULL';
    if (campaignId) {
      params.push(campaignId);
      campaignFilter = `(campaign_id IS NULL OR campaign_id = $${params.length})`;
    }
    const visibilityFilter = includePrivate ? 'TRUE' : 'is_public = true';

    const { rows } = await pool.query(
      `SELECT * FROM calendar.calendar_events
       WHERE calendar_id = $1 AND ${campaignFilter} AND ${visibilityFilter}
       ORDER BY year ASC NULLS LAST, day ASC NULLS LAST, name ASC`,
      params
    );
    return rows;
  },

  // month_id must belong to the same calendar — same guard as
  // calendar_seasons.start_month_id in calendar-season.model.js.
  async monthBelongsToCalendar(monthId, calendarId) {
    const { rows } = await pool.query(
      `SELECT 1 FROM calendar.calendar_months WHERE id = $1 AND calendar_id = $2 LIMIT 1`,
      [monthId, calendarId]
    );
    return rows.length > 0;
  },

  async create(calendarId, data) {
    const {
      campaign_id, name, description, color, is_public,
      year, month_id, day, recurrence,
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO calendar.calendar_events
         (calendar_id, campaign_id, name, description, color, is_public, year, month_id, day, recurrence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [calendarId, campaign_id ?? null, name, description ?? null, color, is_public ?? true,
        year ?? null, month_id ?? null, day ?? null, recurrence ?? 'none']
    );
    return rows[0];
  },

  async update(id, calendarId, data) {
    const {
      campaign_id, name, description, color, is_public,
      year, month_id, day, recurrence,
    } = data;

    const { rows } = await pool.query(
      `UPDATE calendar.calendar_events
       SET campaign_id=$3, name=$4, description=$5, color=$6, is_public=$7,
           year=$8, month_id=$9, day=$10, recurrence=$11, updated_at=NOW()
       WHERE id=$1 AND calendar_id=$2
       RETURNING *`,
      [id, calendarId, campaign_id ?? null, name, description ?? null, color, is_public ?? true,
        year ?? null, month_id ?? null, day ?? null, recurrence ?? 'none']
    );
    return rows[0] || null;
  },

  async delete(id, calendarId) {
    const { rowCount } = await pool.query(
      `DELETE FROM calendar.calendar_events WHERE id=$1 AND calendar_id=$2`,
      [id, calendarId]
    );
    return rowCount > 0;
  },
};

module.exports = CalendarEventModel;
