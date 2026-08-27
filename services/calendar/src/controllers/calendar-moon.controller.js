const CalendarMoonModel = require('../models/calendar-moon.model');
const { loadCalendarOr404, loadCalendarForManageOr404 } = require('./load-calendar');

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function validateBody(body) {
  const { name, cycle_length, color } = body;
  if (!name || !(cycle_length > 0) || !HEX_COLOR_RE.test(color || '')) {
    return 'name, cycle_length (> 0) та color (#rrggbb) є обовʼязковими';
  }
  return null;
}

const CalendarMoonController = {
  async list(req, res) {
    const calendar = await loadCalendarOr404(req, res);
    if (!calendar) return;
    const moons = await CalendarMoonModel.findAllByCalendar(calendar.id);
    res.json({ moons });
  },

  async create(req, res) {
    const calendar = await loadCalendarForManageOr404(req, res);
    if (!calendar) return;
    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const moon = await CalendarMoonModel.create(calendar.id, req.body);
    res.status(201).json({ moon });
  },

  async update(req, res) {
    const calendar = await loadCalendarForManageOr404(req, res);
    if (!calendar) return;
    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const moon = await CalendarMoonModel.update(req.params.moonId, calendar.id, req.body);
    if (!moon) return res.status(404).json({ message: 'Місяць (супутник) не знайдено' });
    res.json({ moon });
  },

  async remove(req, res) {
    const calendar = await loadCalendarForManageOr404(req, res);
    if (!calendar) return;
    const deleted = await CalendarMoonModel.delete(req.params.moonId, calendar.id);
    if (!deleted) return res.status(404).json({ message: 'Місяць (супутник) не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = CalendarMoonController;
