const pool = require('../config/db');

// Full replace of an event's participant set — same "whole-object-replace"
// convention the frontend already uses for weekdays/seasons/moons (no
// partial-patch endpoints anywhere in this service). Cheap: an event rarely
// has more than a handful of participants.
async function setParticipants(eventId, participantIds) {
  await pool.query(`DELETE FROM chronology.calendar_event_participants WHERE event_id = $1`, [eventId]);
  if (!participantIds || participantIds.length === 0) return;
  const values = participantIds.map((_, i) => `($1, $${i + 2})`).join(', ');
  await pool.query(
    `INSERT INTO chronology.calendar_event_participants (event_id, entry_id) VALUES ${values}`,
    [eventId, ...participantIds]
  );
}

const ChronologyEventModel = {
  // campaignId omitted/null -> only global lore events (campaign_id IS NULL).
  // campaignId set -> global events PLUS that campaign's own events.
  // includePrivate -> managers (admin/game_master) see is_public=false
  // events too; regular users only ever see is_public=true ones.
  // synced: { userId, isAdmin } -> крім подій цього календаря, ще й події всіх
  // синхронізованих календарів (is_default або sync_offset_days), які бачить
  // користувач; викликається лише для синхронізованого календаря (див.
  // контролер) — сітки решти календарів показують ці події через спільну вісь.
  async findAllByCalendar(calendarId, { campaignId, includePrivate, synced } = {}) {
    const params = [calendarId];
    let calendarFilter = 'e.calendar_id = $1';
    if (synced) {
      // Адмін бачить усі календарі — userId у запит не потрапляє: pg відхиляє
      // запит, де параметрів більше, ніж плейсхолдерів.
      let visibility = 'TRUE';
      if (!synced.isAdmin) {
        params.push(synced.userId);
        visibility = `(c.is_private = false OR c.creator_id = $${params.length})`;
      }
      calendarFilter = `(e.calendar_id = $1 OR e.calendar_id IN (
        SELECT c.id FROM chronology.calendars c
        WHERE (c.is_default OR c.sync_offset_days IS NOT NULL) AND ${visibility}))`;
    }
    let campaignFilter = 'e.campaign_id IS NULL';
    if (campaignId) {
      params.push(campaignId);
      campaignFilter = `(e.campaign_id IS NULL OR e.campaign_id = $${params.length})`;
    }
    const visibilityFilter = includePrivate ? 'TRUE' : 'e.is_public = true';

    const { rows } = await pool.query(
      `SELECT e.* FROM chronology.calendar_events e
       WHERE ${calendarFilter} AND ${campaignFilter} AND ${visibilityFilter}
       ORDER BY e.year ASC NULLS LAST, e.day ASC NULLS LAST, e.name ASC`,
      params
    );
    if (rows.length === 0) return rows;

    // Resolved in a second query rather than a join — a location/NPC/
    // creature's own display name lives in another service entirely, so
    // the frontend resolves participant_ids/location_id to names itself
    // (same cross-service convention as campaign_id everywhere else here).
    const { rows: participantRows } = await pool.query(
      `SELECT event_id, entry_id FROM chronology.calendar_event_participants WHERE event_id = ANY($1::uuid[])`,
      [rows.map((r) => r.id)]
    );
    const byEvent = new Map();
    for (const { event_id, entry_id } of participantRows) {
      if (!byEvent.has(event_id)) byEvent.set(event_id, []);
      byEvent.get(event_id).push(entry_id);
    }
    return rows.map((r) => ({ ...r, participant_ids: byEvent.get(r.id) || [] }));
  },

  // month_id/end_month_id must belong to the same calendar — same guard as
  // calendar_seasons.start_month_id in chronology-season.model.js.
  async monthBelongsToCalendar(monthId, calendarId) {
    const { rows } = await pool.query(
      `SELECT 1 FROM chronology.calendar_months WHERE id = $1 AND calendar_id = $2 LIMIT 1`,
      [monthId, calendarId]
    );
    return rows.length > 0;
  },

  async create(calendarId, data) {
    const {
      campaign_id, name, description, color, is_public,
      year, month_id, day, recurrence,
      location_id, region, end_year, end_month_id, end_day, duration_display, participant_ids,
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO chronology.calendar_events
         (calendar_id, campaign_id, name, description, color, is_public, year, month_id, day, recurrence,
          location_id, region, end_year, end_month_id, end_day, duration_display)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [calendarId, campaign_id ?? null, name, description ?? null, color, is_public ?? true,
        year ?? null, month_id ?? null, day ?? null, recurrence ?? 'none',
        location_id ?? null, region ?? null, end_year ?? null, end_month_id ?? null, end_day ?? null,
        duration_display ?? 'start']
    );
    const event = rows[0];
    await setParticipants(event.id, participant_ids);
    return { ...event, participant_ids: participant_ids || [] };
  },

  // newCalendarId — перенесення події в інший календар (за чиєю структурою
  // рахується її дата й повторюваність); без нього лишається в calendarId.
  async update(id, calendarId, data, newCalendarId = calendarId) {
    const {
      campaign_id, name, description, color, is_public,
      year, month_id, day, recurrence,
      location_id, region, end_year, end_month_id, end_day, duration_display, participant_ids,
    } = data;

    const { rows } = await pool.query(
      `UPDATE chronology.calendar_events
       SET calendar_id=$18, campaign_id=$3, name=$4, description=$5, color=$6, is_public=$7,
           year=$8, month_id=$9, day=$10, recurrence=$11,
           location_id=$12, region=$13, end_year=$14, end_month_id=$15, end_day=$16,
           duration_display=$17, updated_at=NOW()
       WHERE id=$1 AND calendar_id=$2
       RETURNING *`,
      [id, calendarId, campaign_id ?? null, name, description ?? null, color, is_public ?? true,
        year ?? null, month_id ?? null, day ?? null, recurrence ?? 'none',
        location_id ?? null, region ?? null, end_year ?? null, end_month_id ?? null, end_day ?? null,
        duration_display ?? 'start', newCalendarId]
    );
    if (!rows[0]) return null;
    await setParticipants(id, participant_ids);
    return { ...rows[0], participant_ids: participant_ids || [] };
  },

  // Every event (across all calendars the viewer can see) that lists this
  // entry (NPC/creature id) as a participant — the NPC page's "Події" block.
  // Carries the calendar and month names so the caller can label dates
  // without loading each calendar's months separately. Managers see private
  // and campaign-specific events too; everyone else only public lore events
  // (campaign_id IS NULL), same as findAllByCalendar without a campaign.
  async findAllByParticipant(entryId, { userId, isAdmin, isManager }) {
    const calendarVisibility = isAdmin ? 'TRUE' : '(c.is_private = false OR c.creator_id = $2)';
    const eventVisibility = isManager ? 'TRUE' : '(e.is_public = true AND e.campaign_id IS NULL)';
    const { rows } = await pool.query(
      `SELECT e.*, c.name AS calendar_name, c.current_era_name, c.previous_era_name, c.first_day_offset,
              m.name AS month_name, em.name AS end_month_name,
              (SELECT COALESCE(json_agg(json_build_object('id', cm.id, 'name', cm.name, 'length', cm.length) ORDER BY cm.order_num), '[]'::json)
                 FROM chronology.calendar_months cm WHERE cm.calendar_id = c.id) AS preview_months,
              (SELECT COALESCE(json_agg(json_build_object('id', er.id, 'name', er.name, 'start_year', er.start_year,
                        'start_month_id', er.start_month_id, 'start_day', er.start_day, 'cycle_years', er.cycle_years)
                        ORDER BY er.start_year, er.start_day), '[]'::json)
                 FROM chronology.calendar_eras er WHERE er.calendar_id = c.id) AS preview_eras,
              (SELECT count(*) FROM chronology.calendar_weekdays w WHERE w.calendar_id = c.id)::int AS weekday_count
       FROM chronology.calendar_event_participants p
       JOIN chronology.calendar_events e ON e.id = p.event_id
       JOIN chronology.calendars c ON c.id = e.calendar_id
       LEFT JOIN chronology.calendar_months m ON m.id = e.month_id
       LEFT JOIN chronology.calendar_months em ON em.id = e.end_month_id
       WHERE p.entry_id = $1 AND ${calendarVisibility} AND ${eventVisibility}
       ORDER BY c.name ASC, e.year ASC NULLS LAST, m.order_num ASC NULLS LAST, e.day ASC NULLS LAST, e.name ASC`,
      [entryId, userId]
    );
    return rows;
  },

  async findById(id, calendarId) {
    const { rows } = await pool.query(
      `SELECT * FROM chronology.calendar_events WHERE id = $1 AND calendar_id = $2`,
      [id, calendarId]
    );
    return rows[0] || null;
  },

  // Point add/remove of a single participant — used from an NPC's page,
  // where replacing the event's whole participant set (setParticipants)
  // would need the full event payload.
  async addParticipant(eventId, entryId) {
    await pool.query(
      `INSERT INTO chronology.calendar_event_participants (event_id, entry_id)
       VALUES ($1, $2)
       ON CONFLICT (event_id, entry_id) DO NOTHING`,
      [eventId, entryId]
    );
  },

  async removeParticipant(eventId, entryId) {
    const { rowCount } = await pool.query(
      `DELETE FROM chronology.calendar_event_participants WHERE event_id = $1 AND entry_id = $2`,
      [eventId, entryId]
    );
    return rowCount > 0;
  },

  async delete(id, calendarId) {
    // calendar_event_participants rows cascade via their own FK — no
    // separate cleanup needed here.
    const { rowCount } = await pool.query(
      `DELETE FROM chronology.calendar_events WHERE id=$1 AND calendar_id=$2`,
      [id, calendarId]
    );
    return rowCount > 0;
  },
};

module.exports = ChronologyEventModel;
