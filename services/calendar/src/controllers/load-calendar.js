const CalendarModel = require('../models/calendar.model');

/**
 * Завантажує календар з урахуванням видимості (публічний/власний/адмін) або
 * сам відповідає 404 і повертає null.
 * Виклик: `const calendar = await loadCalendarOr404(req, res); if (!calendar) return;`
 */
async function loadCalendarOr404(req, res) {
  const calendar = await CalendarModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
  if (!calendar) { res.status(404).json({ message: 'Календар не знайдено' }); return null; }
  return calendar;
}

// Без фільтра видимості — для write-шляхів, які вже захищені
// requireCalendarManager (admin/game_master керують будь-яким календарем,
// не лише власним).
async function loadCalendarForManageOr404(req, res) {
  const calendar = await CalendarModel.findByIdRaw(req.params.id);
  if (!calendar) { res.status(404).json({ message: 'Календар не знайдено' }); return null; }
  return calendar;
}

module.exports = { loadCalendarOr404, loadCalendarForManageOr404 };
