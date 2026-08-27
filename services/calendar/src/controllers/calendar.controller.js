const CalendarModel = require('../models/calendar.model');

const CalendarController = {
  async list(req, res) {
    const calendars = await CalendarModel.findAll(req.user.sub, req.user.role === 'admin');
    res.json({ calendars });
  },

  async getOne(req, res) {
    const calendar = await CalendarModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!calendar) return res.status(404).json({ message: 'Календар не знайдено' });
    res.json({ calendar });
  },

  async create(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const calendar = await CalendarModel.create(req.user.sub, req.body);
    res.status(201).json({ calendar });
  },

  async update(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });

    if (req.body.default_month_id && !await CalendarModel.monthBelongsToCalendar(req.body.default_month_id, req.params.id)) {
      return res.status(400).json({ message: 'default_month_id має належати цьому календарю' });
    }

    const calendar = await CalendarModel.update(req.params.id, req.body);
    if (!calendar) return res.status(404).json({ message: 'Календар не знайдено' });
    res.json({ calendar });
  },

  async remove(req, res) {
    const deleted = await CalendarModel.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Календар не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = CalendarController;
