const CalendarEventModel = require('../models/calendar-event.model');
const { loadCalendarOr404, loadCalendarForManageOr404 } = require('./load-calendar');

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const VALID_RECURRENCE = ['none', 'yearly', 'monthly', 'weekly'];

function validateBody(body) {
  const { name, color, recurrence = 'none', day } = body;
  if (!name || !HEX_COLOR_RE.test(color || '')) {
    return 'name та color (#rrggbb) є обовʼязковими';
  }
  if (!VALID_RECURRENCE.includes(recurrence)) {
    return `recurrence має бути одним з: ${VALID_RECURRENCE.join(', ')}`;
  }
  if (day !== undefined && day !== null && !(day > 0)) {
    return 'day має бути додатним числом';
  }
  return null;
}

const CalendarEventController = {
  // ?campaign_id=... adds that campaign's own events on top of the global
  // (campaign_id IS NULL) ones; without it, only global events are returned.
  async list(req, res) {
    const calendar = await loadCalendarOr404(req, res);
    if (!calendar) return;

    const isManager = ['admin', 'game_master'].includes(req.user.role);
    const events = await CalendarEventModel.findAllByCalendar(calendar.id, {
      campaignId: req.query.campaign_id,
      includePrivate: isManager,
    });
    res.json({ events });
  },

  async create(req, res) {
    const calendar = await loadCalendarForManageOr404(req, res);
    if (!calendar) return;
    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    if (req.body.month_id && !await CalendarEventModel.monthBelongsToCalendar(req.body.month_id, calendar.id)) {
      return res.status(400).json({ message: 'month_id має належати цьому календарю' });
    }

    const event = await CalendarEventModel.create(calendar.id, req.body);
    res.status(201).json({ event });
  },

  async update(req, res) {
    const calendar = await loadCalendarForManageOr404(req, res);
    if (!calendar) return;
    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    if (req.body.month_id && !await CalendarEventModel.monthBelongsToCalendar(req.body.month_id, calendar.id)) {
      return res.status(400).json({ message: 'month_id має належати цьому календарю' });
    }

    const event = await CalendarEventModel.update(req.params.eventId, calendar.id, req.body);
    if (!event) return res.status(404).json({ message: 'Подію не знайдено' });
    res.json({ event });
  },

  async remove(req, res) {
    const calendar = await loadCalendarForManageOr404(req, res);
    if (!calendar) return;
    const deleted = await CalendarEventModel.delete(req.params.eventId, calendar.id);
    if (!deleted) return res.status(404).json({ message: 'Подію не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = CalendarEventController;
