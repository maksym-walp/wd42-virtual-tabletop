const ChronologyWeekdayModel = require('../models/chronology-weekday.model');
const { loadChronologyOr404, loadChronologyForManageOr404 } = require('./load-chronology');

const ChronologyWeekdayController = {
  async list(req, res) {
    const calendar = await loadChronologyOr404(req, res);
    if (!calendar) return;
    const weekdays = await ChronologyWeekdayModel.findAllByCalendar(calendar.id);
    res.json({ weekdays });
  },

  async create(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const { name, order_num } = req.body;
    if (!name || order_num === undefined) {
      return res.status(400).json({ message: 'name та order_num є обовʼязковими' });
    }
    const weekday = await ChronologyWeekdayModel.create(calendar.id, req.body);
    res.status(201).json({ weekday });
  },

  async update(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const { name, order_num } = req.body;
    if (!name || order_num === undefined) {
      return res.status(400).json({ message: 'name та order_num є обовʼязковими' });
    }
    const weekday = await ChronologyWeekdayModel.update(req.params.weekdayId, calendar.id, req.body);
    if (!weekday) return res.status(404).json({ message: 'День тижня не знайдено' });
    res.json({ weekday });
  },

  async remove(req, res) {
    const calendar = await loadChronologyForManageOr404(req, res);
    if (!calendar) return;
    const deleted = await ChronologyWeekdayModel.delete(req.params.weekdayId, calendar.id);
    if (!deleted) return res.status(404).json({ message: 'День тижня не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = ChronologyWeekdayController;
