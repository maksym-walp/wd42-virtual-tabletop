const ChronologyEventModel = require('../models/chronology-event.model');
const ChronologyModel = require('../models/chronology.model');
const { loadChronologyOr404, loadChronologyForManageOr404 } = require('./load-chronology');

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const VALID_RECURRENCE = ['none', 'yearly', 'monthly', 'weekly'];
const VALID_DURATION_DISPLAY = ['start', 'start_end', 'every_day', 'none'];

async function validateBody(body) {
  const { name, color, recurrence = 'none', day, end_day, location_id, region, duration_display = 'start', event_type } = body;
  if (!name || !HEX_COLOR_RE.test(color || '')) {
    return 'name та color (#rrggbb) є обовʼязковими';
  }
  // Тип — ключ із event_types (адмін-панель); невідомий ключ відхиляємо, щоб
  // подія не посилалася на тип, якого немає. Порожній — подія без типу.
  if (event_type != null && event_type !== '') {
    const types = await ChronologyEventModel.getEventTypes();
    if (!types.some((t) => t.key === event_type)) return 'event_type: невідомий тип події';
  }
  if (!VALID_RECURRENCE.includes(recurrence)) {
    return `recurrence має бути одним з: ${VALID_RECURRENCE.join(', ')}`;
  }
  if (!VALID_DURATION_DISPLAY.includes(duration_display)) {
    return `duration_display має бути одним з: ${VALID_DURATION_DISPLAY.join(', ')}`;
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
    // ?scope=synced — події всіх синхронізованих календарів (для синхронізованого
    // календаря): сітка показує їх через спільну вісь. Несинхронізований
    // календар бачить лише власні події, хоч би що попросили.
    const isSynced = Boolean(calendar.is_default) || calendar.sync_offset_days != null;
    const events = await ChronologyEventModel.findAllByCalendar(calendar.id, {
      campaignId: req.query.campaign_id,
      includePrivate: isManager,
      synced: req.query.scope === 'synced' && isSynced
        ? { userId: req.user.sub, isAdmin: req.user.role === 'admin' }
        : undefined,
    });
    res.json({ events });
  },

  async create(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const validationError = await validateBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const monthError = await validateMonthRefs(req.body, calendar.id);
    if (monthError) return res.status(400).json({ message: monthError });

    const event = await ChronologyEventModel.create(calendar.id, req.body);
    res.status(201).json({ event });
  },

  async update(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const validationError = await validateBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    // body.calendar_id інший за :id — перенесення події в інший календар;
    // дати (month_id) тоді мають належати календарю-призначенню.
    let target = calendar;
    if (req.body.calendar_id && req.body.calendar_id !== calendar.id) {
      target = await ChronologyModel.findByIdRaw(req.body.calendar_id);
      if (!target) return res.status(400).json({ message: 'calendar_id: календар не знайдено' });
    }

    const monthError = await validateMonthRefs(req.body, target.id);
    if (monthError) return res.status(400).json({ message: monthError });

    const event = await ChronologyEventModel.update(req.params.eventId, calendar.id, req.body, target.id);
    if (!event) return res.status(404).json({ message: 'Подію не знайдено' });
    res.json({ event });
  },

  // Типи подій (назва + колір) — задаються в адмін-панелі, читають усі
  // автентифіковані.
  async listTypes(req, res) {
    res.json({ event_types: await ChronologyEventModel.getEventTypes() });
  },

  // Одна подія календаря — для сторінки події. Календар мусить бути видимий
  // глядачу; приватні події й події кампаній — лише менеджерам (кампанійні
  // ще й тим, хто відкриває їх з контексту цієї кампанії, ?campaign_id).
  async getOne(req, res) {
    const calendar = await loadChronologyOr404(req, res);
    if (!calendar) return;
    const event = await ChronologyEventModel.findDetailed(req.params.eventId, calendar.id);
    const isManager = ['admin', 'game_master'].includes(req.user.role);
    const visible = event && (isManager || (
      event.is_public && (!event.campaign_id || event.campaign_id === req.query.campaign_id)
    ));
    if (!visible) return res.status(404).json({ message: 'Подію не знайдено' });
    res.json({ event });
  },

  async listByParticipant(req, res) {
    const events = await ChronologyEventModel.findAllByParticipant(req.params.entryId, {
      userId: req.user.sub,
      isAdmin: req.user.role === 'admin',
      isManager: ['admin', 'game_master'].includes(req.user.role),
    });
    res.json({ events });
  },

  async addParticipant(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const { entry_id: entryId } = req.body;
    if (!entryId) return res.status(400).json({ message: 'entry_id є обовʼязковим' });

    const event = await ChronologyEventModel.findById(req.params.eventId, calendar.id);
    if (!event) return res.status(404).json({ message: 'Подію не знайдено' });

    await ChronologyEventModel.addParticipant(event.id, entryId);
    res.status(201).json({ event_id: event.id, entry_id: entryId });
  },

  async removeParticipant(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const event = await ChronologyEventModel.findById(req.params.eventId, calendar.id);
    if (!event) return res.status(404).json({ message: 'Подію не знайдено' });

    const removed = await ChronologyEventModel.removeParticipant(event.id, req.params.entryId);
    if (!removed) return res.status(404).json({ message: 'Учасника не знайдено' });
    res.json({ message: 'Видалено' });
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
