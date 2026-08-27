const CalendarMonthModel = require('../models/calendar-month.model');
const { loadCalendarOr404, loadCalendarForManageOr404 } = require('./load-calendar');

const CalendarMonthController = {
  async list(req, res) {
    const calendar = await loadCalendarOr404(req, res);
    if (!calendar) return;
    const months = await CalendarMonthModel.findAllByCalendar(calendar.id);
    res.json({ months });
  },

  async create(req, res) {
    const calendar = await loadCalendarForManageOr404(req, res);
    if (!calendar) return;
    const { name, length, order_num } = req.body;
    if (!name || !(length > 0) || order_num === undefined) {
      return res.status(400).json({ message: 'name, length (> 0) та order_num є обовʼязковими' });
    }
    const month = await CalendarMonthModel.create(calendar.id, req.body);
    res.status(201).json({ month });
  },

  async update(req, res) {
    const calendar = await loadCalendarForManageOr404(req, res);
    if (!calendar) return;
    const { name, length, order_num } = req.body;
    if (!name || !(length > 0) || order_num === undefined) {
      return res.status(400).json({ message: 'name, length (> 0) та order_num є обовʼязковими' });
    }
    const month = await CalendarMonthModel.update(req.params.monthId, calendar.id, req.body);
    if (!month) return res.status(404).json({ message: 'Місяць не знайдено' });
    res.json({ month });
  },

  async remove(req, res) {
    const calendar = await loadCalendarForManageOr404(req, res);
    if (!calendar) return;
    const deleted = await CalendarMonthModel.delete(req.params.monthId, calendar.id);
    if (!deleted) return res.status(404).json({ message: 'Місяць не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = CalendarMonthController;
