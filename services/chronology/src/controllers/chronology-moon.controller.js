const ChronologyMoonModel = require('../models/chronology-moon.model');
const { loadChronologyOr404, loadChronologyForManageOr404 } = require('./load-chronology');

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function validateBody(body) {
  const { name, cycle_length, color } = body;
  if (!name || !(cycle_length > 0) || !HEX_COLOR_RE.test(color || '')) {
    return 'name, cycle_length (> 0) та color (#rrggbb) є обовʼязковими';
  }
  return null;
}

const ChronologyMoonController = {
  async list(req, res) {
    const calendar = await loadChronologyOr404(req, res);
    if (!calendar) return;
    const moons = await ChronologyMoonModel.findAllByCalendar(calendar.id);
    res.json({ moons });
  },

  async create(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const moon = await ChronologyMoonModel.create(calendar.id, req.body);
    res.status(201).json({ moon });
  },

  async update(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const moon = await ChronologyMoonModel.update(req.params.moonId, calendar.id, req.body);
    if (!moon) return res.status(404).json({ message: 'Місяць (супутник) не знайдено' });
    res.json({ moon });
  },

  async remove(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const deleted = await ChronologyMoonModel.delete(req.params.moonId, calendar.id);
    if (!deleted) return res.status(404).json({ message: 'Місяць (супутник) не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = ChronologyMoonController;
