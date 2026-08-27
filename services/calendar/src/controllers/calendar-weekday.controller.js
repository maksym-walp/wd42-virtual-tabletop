const CalendarWeekdayModel = require('../models/calendar-weekday.model');
const { loadCalendarOr404, loadCalendarForManageOr404 } = require('./load-calendar');

const CalendarWeekdayController = {
  async list(req, res) {
    const calendar = await loadCalendarOr404(req, res);
    if (!calendar) return;
    const weekdays = await CalendarWeekdayModel.findAllByCalendar(calendar.id);
    res.json({ weekdays });
  },

  async create(req, res) {
    const calendar = await loadCalendarForManageOr404(req, res);
    if (!calendar) return;
    const { name, order_num } = req.body;
    if (!name || order_num === undefined) {
      return res.status(400).json({ message: 'name та order_num є обовʼязковими' });
    }
    const weekday = await CalendarWeekdayModel.create(calendar.id, req.body);
    res.status(201).json({ weekday });
  },

  async update(req, res) {
    const calendar = await loadCalendarForManageOr404(req, res);
    if (!calendar) return;
    const { name, order_num } = req.body;
    if (!name || order_num === undefined) {
      return res.status(400).json({ message: 'name та order_num є обовʼязковими' });
    }
    const weekday = await CalendarWeekdayModel.update(req.params.weekdayId, calendar.id, req.body);
    if (!weekday) return res.status(404).json({ message: 'День тижня не знайдено' });
    res.json({ weekday });
  },

  async remove(req, res) {
    const calendar = await loadCalendarForManageOr404(req, res);
    if (!calendar) return;
    const deleted = await CalendarWeekdayModel.delete(req.params.weekdayId, calendar.id);
    if (!deleted) return res.status(404).json({ message: 'День тижня не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = CalendarWeekdayController;
