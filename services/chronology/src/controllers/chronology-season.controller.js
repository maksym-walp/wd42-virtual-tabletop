const ChronologySeasonModel = require('../models/chronology-season.model');
const { loadChronologyOr404, loadChronologyForManageOr404 } = require('./load-chronology');

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function validateBody(body) {
  const { name, start_month_id, start_day, color } = body;
  if (!name || !start_month_id || !(start_day > 0) || !HEX_COLOR_RE.test(color || '')) {
    return 'name, start_month_id, start_day (> 0) та color (#rrggbb) є обовʼязковими';
  }
  return null;
}

const ChronologySeasonController = {
  async list(req, res) {
    const calendar = await loadChronologyOr404(req, res);
    if (!calendar) return;
    const seasons = await ChronologySeasonModel.findAllByCalendar(calendar.id);
    res.json({ seasons });
  },

  async create(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    if (!await ChronologySeasonModel.monthBelongsToCalendar(req.body.start_month_id, calendar.id)) {
      return res.status(400).json({ message: 'start_month_id має належати цьому календарю' });
    }

    const season = await ChronologySeasonModel.create(calendar.id, req.body);
    res.status(201).json({ season });
  },

  async update(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    if (!await ChronologySeasonModel.monthBelongsToCalendar(req.body.start_month_id, calendar.id)) {
      return res.status(400).json({ message: 'start_month_id має належати цьому календарю' });
    }

    const season = await ChronologySeasonModel.update(req.params.seasonId, calendar.id, req.body);
    if (!season) return res.status(404).json({ message: 'Сезон не знайдено' });
    res.json({ season });
  },

  async remove(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const deleted = await ChronologySeasonModel.delete(req.params.seasonId, calendar.id);
    if (!deleted) return res.status(404).json({ message: 'Сезон не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = ChronologySeasonController;
