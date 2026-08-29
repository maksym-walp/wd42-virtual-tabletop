const ChronologyEventModel = require('../models/chronology-event.model');
const { loadChronologyOr404, loadChronologyForManageOr404 } = require('./load-chronology');

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const VALID_RECURRENCE = ['none', 'yearly', 'monthly', 'weekly'];

function validateBody(body) {
  const { name, color, recurrence = 'none', day, end_day, location_id, region } = body;
  if (!name || !HEX_COLOR_RE.test(color || '')) {
    return 'name та color (#rrggbb) є обовʼязковими';
  }
  if (!VALID_RECURRENCE.includes(recurrence)) {
    return `recurrence має бути одним з: ${VALID_RECURRENCE.join(', ')}`;
  }
  if (day !== undefined && day !== null && !(day > 0)) {
    return 'day має бути додатним числом';
  }
  if (end_day !== undefined && end_day !== null && !(end_day > 0)) {
    return 'end_day має бути додатним числом';
  }
  if (location_id && region) {
    return 'location_id та region взаємовиключні — вкажіть щось одне';
  }
  return null;
}

// month_id/end_month_id (if given) must belong to this same calendar — same
// guard the season endpoints already apply to start_month_id.
async function validateMonthRefs(body, calendarId) {
  if (body.month_id && !await ChronologyEventModel.monthBelongsToCalendar(body.month_id, calendarId)) {
    return 'month_id має належати цьому календарю';
  }
  if (body.end_month_id && !await ChronologyEventModel.monthBelongsToCalendar(body.end_month_id, calendarId)) {
    return 'end_month_id має належати цьому календарю';
  }
  return null;
}

const ChronologyEventController = {
  // ?campaign_id=... adds that campaign's own events on top of the global
  // (campaign_id IS NULL) ones; without it, only global events are returned.
  async list(req, res) {
    const calendar = await loadChronologyOr404(req, res);
    if (!calendar) return;

    const isManager = ['admin', 'game_master'].includes(req.user.role);
    const events = await ChronologyEventModel.findAllByCalendar(calendar.id, {
      campaignId: req.query.campaign_id,
      includePrivate: isManager,
    });
    res.json({ events });
  },

  async create(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const monthError = await validateMonthRefs(req.body, calendar.id);
    if (monthError) return res.status(400).json({ message: monthError });

    const event = await ChronologyEventModel.create(calendar.id, req.body);
    res.status(201).json({ event });
  },

  async update(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const monthError = await validateMonthRefs(req.body, calendar.id);
    if (monthError) return res.status(400).json({ message: monthError });

    const event = await ChronologyEventModel.update(req.params.eventId, calendar.id, req.body);
    if (!event) return res.status(404).json({ message: 'Подію не знайдено' });
    res.json({ event });
  },

  async remove(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const deleted = await ChronologyEventModel.delete(req.params.eventId, calendar.id);
    if (!deleted) return res.status(404).json({ message: 'Подію не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = ChronologyEventController;
