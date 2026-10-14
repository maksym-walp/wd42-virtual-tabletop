const ChronologyEraModel = require('../models/chronology-era.model');
const { loadChronologyOr404, loadChronologyForManageOr404 } = require('./load-chronology');

function validateBody(body) {
  const { name, start_year, start_month_id, start_day, cycle_years } = body;
  if (!name || !start_month_id || !Number.isInteger(start_year) || !(start_day > 0)) {
    return 'name, start_year (ціле), start_month_id та start_day (> 0) є обовʼязковими';
  }
  if (!Number.isInteger(start_day)) return 'start_day має бути цілим числом';
  if (cycle_years !== undefined && cycle_years !== null && !(Number.isInteger(cycle_years) && cycle_years > 0)) {
    return 'cycle_years має бути додатним цілим або null';
  }
  return null;
}

// Місяць початку має належати календарю, а день — вміщатися в нього.
async function validateStart(body, calendarId) {
  const length = await ChronologyEraModel.monthLengthInCalendar(body.start_month_id, calendarId);
  if (length == null) return 'start_month_id має належати цьому календарю';
  if (body.start_day > length) return `start_day не може перевищувати довжину місяця (${length})`;
  return null;
}

const ChronologyEraController = {
  async list(req, res) {
    const calendar = await loadChronologyOr404(req, res);
    if (!calendar) return;
    const eras = await ChronologyEraModel.findAllByCalendar(calendar.id);
    res.json({ eras });
  },

  async create(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const error = validateBody(req.body) || await validateStart(req.body, calendar.id);
    if (error) return res.status(400).json({ message: error });
    const era = await ChronologyEraModel.create(calendar.id, req.body);
    res.status(201).json({ era });
  },

  async update(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const error = validateBody(req.body) || await validateStart(req.body, calendar.id);
    if (error) return res.status(400).json({ message: error });
    const era = await ChronologyEraModel.update(req.params.eraId, calendar.id, req.body);
    if (!era) return res.status(404).json({ message: 'Еру не знайдено' });
    res.json({ era });
  },

  async remove(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const deleted = await ChronologyEraModel.delete(req.params.eraId, calendar.id);
    if (!deleted) return res.status(404).json({ message: 'Еру не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = ChronologyEraController;
