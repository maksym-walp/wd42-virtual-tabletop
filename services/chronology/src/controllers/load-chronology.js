const ChronologyModel = require('../models/chronology.model');

/**
 * Завантажує календар з урахуванням видимості (публічний/власний/адмін) або
 * сам відповідає 404 і повертає null.
 * Виклик: `const calendar = await loadChronologyOr404(req, res); if (!calendar) return;`
 */
async function loadChronologyOr404(req, res) {
  const calendar = await ChronologyModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
  if (!calendar) { res.status(404).json({ message: 'Календар не знайдено' }); return null; }
  return calendar;
}

// Без фільтра видимості — для write-шляхів, які вже захищені
// requireChronologyManager (admin/game_master керують будь-яким календарем,
// не лише власним).
async function loadChronologyForManageOr404(req, res) {
  const calendar = await ChronologyModel.findByIdRaw(req.params.id);
  if (!calendar) { res.status(404).json({ message: 'Календар не знайдено' }); return null; }
  return calendar;
}

module.exports = { loadChronologyOr404, loadChronologyForManageOr404 };
