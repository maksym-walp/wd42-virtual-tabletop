const CalendarSeasonModel = require('../models/calendar-season.model');
const { loadCalendarOr404, loadCalendarForManageOr404 } = require('./load-calendar');

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function validateBody(body) {
  const { name, start_month_id, start_day, color } = body;
  if (!name || !start_month_id || !(start_day > 0) || !HEX_COLOR_RE.test(color || '')) {
    return 'name, start_month_id, start_day (> 0) та color (#rrggbb) є обовʼязковими';
  }
  return null;
}

const CalendarSeasonController = {
  async list(req, res) {
    const calendar = await loadCalendarOr404(req, res);
    if (!calendar) return;
    const seasons = await CalendarSeasonModel.findAllByCalendar(calendar.id);
    res.json({ seasons });
  },

  async create(req, res) {
    const calendar = await loadCalendarForManageOr404(req, res);
    if (!calendar) return;
    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    if (!await CalendarSeasonModel.monthBelongsToCalendar(req.body.start_month_id, calendar.id)) {
      return res.status(400).json({ message: 'start_month_id має належати цьому календарю' });
    }

    const season = await CalendarSeasonModel.create(calendar.id, req.body);
    res.status(201).json({ season });
  },

  async update(req, res) {
    const calendar = await loadCalendarForManageOr404(req, res);
    if (!calendar) return;
    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    if (!await CalendarSeasonModel.monthBelongsToCalendar(req.body.start_month_id, calendar.id)) {
      return res.status(400).json({ message: 'start_month_id має належати цьому календарю' });
    }

    const season = await CalendarSeasonModel.update(req.params.seasonId, calendar.id, req.body);
    if (!season) return res.status(404).json({ message: 'Сезон не знайдено' });
    res.json({ season });
  },

  async remove(req, res) {
    const calendar = await loadCalendarForManageOr404(req, res);
    if (!calendar) return;
    const deleted = await CalendarSeasonModel.delete(req.params.seasonId, calendar.id);
    if (!deleted) return res.status(404).json({ message: 'Сезон не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = CalendarSeasonController;
