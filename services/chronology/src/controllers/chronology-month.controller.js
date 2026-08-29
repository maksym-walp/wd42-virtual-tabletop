const ChronologyMonthModel = require('../models/chronology-month.model');
const { loadChronologyOr404, loadChronologyForManageOr404 } = require('./load-chronology');

const ChronologyMonthController = {
  async list(req, res) {
    const calendar = await loadChronologyOr404(req, res);
    if (!calendar) return;
    const months = await ChronologyMonthModel.findAllByCalendar(calendar.id);
    res.json({ months });
  },

  async create(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const { name, length, order_num } = req.body;
    if (!name || !(length > 0) || order_num === undefined) {
      return res.status(400).json({ message: 'name, length (> 0) та order_num є обовʼязковими' });
    }
    const month = await ChronologyMonthModel.create(calendar.id, req.body);
    res.status(201).json({ month });
  },

  async update(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const { name, length, order_num } = req.body;
    if (!name || !(length > 0) || order_num === undefined) {
      return res.status(400).json({ message: 'name, length (> 0) та order_num є обовʼязковими' });
    }
    const month = await ChronologyMonthModel.update(req.params.monthId, calendar.id, req.body);
    if (!month) return res.status(404).json({ message: 'Місяць не знайдено' });
    res.json({ month });
  },

  async remove(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const deleted = await ChronologyMonthModel.delete(req.params.monthId, calendar.id);
    if (!deleted) return res.status(404).json({ message: 'Місяць не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = ChronologyMonthController;
