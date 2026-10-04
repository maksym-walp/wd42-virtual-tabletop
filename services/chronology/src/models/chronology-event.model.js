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
  async findAllByCalendar(calendarId, { campaignId, includePrivate } = {}) {
    const params = [calendarId];
    let campaignFilter = 'campaign_id IS NULL';
    if (campaignId) {
      params.push(campaignId);
      campaignFilter = `(campaign_id IS NULL OR campaign_id = $${params.length})`;
    }
    const visibilityFilter = includePrivate ? 'TRUE' : 'is_public = true';

    const { rows } = await pool.query(
      `SELECT * FROM chronology.calendar_events
       WHERE calendar_id = $1 AND ${campaignFilter} AND ${visibilityFilter}
       ORDER BY year ASC NULLS LAST, day ASC NULLS LAST, name ASC`,
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
      location_id, region, end_year, end_month_id, end_day, participant_ids,
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO chronology.calendar_events
         (calendar_id, campaign_id, name, description, color, is_public, year, month_id, day, recurrence,
          location_id, region, end_year, end_month_id, end_day)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [calendarId, campaign_id ?? null, name, description ?? null, color, is_public ?? true,
        year ?? null, month_id ?? null, day ?? null, recurrence ?? 'none',
        location_id ?? null, region ?? null, end_year ?? null, end_month_id ?? null, end_day ?? null]
    );
    const event = rows[0];
    await setParticipants(event.id, participant_ids);
    return { ...event, participant_ids: participant_ids || [] };
  },

  async update(id, calendarId, data) {
    const {
      campaign_id, name, description, color, is_public,
      year, month_id, day, recurrence,
      location_id, region, end_year, end_month_id, end_day, participant_ids,
    } = data;

    const { rows } = await pool.query(
      `UPDATE chronology.calendar_events
       SET campaign_id=$3, name=$4, description=$5, color=$6, is_public=$7,
           year=$8, month_id=$9, day=$10, recurrence=$11,
           location_id=$12, region=$13, end_year=$14, end_month_id=$15, end_day=$16, updated_at=NOW()
       WHERE id=$1 AND calendar_id=$2
       RETURNING *`,
      [id, calendarId, campaign_id ?? null, name, description ?? null, color, is_public ?? true,
        year ?? null, month_id ?? null, day ?? null, recurrence ?? 'none',
        location_id ?? null, region ?? null, end_year ?? null, end_month_id ?? null, end_day ?? null]
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
      `SELECT e.*, c.name AS calendar_name, c.current_era_name, c.previous_era_name,
              m.name AS month_name, em.name AS end_month_name
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
