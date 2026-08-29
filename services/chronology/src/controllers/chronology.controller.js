const ChronologyModel = require('../models/chronology.model');

const ChronologyController = {
  async list(req, res) {
    const calendars = await ChronologyModel.findAll(req.user.sub, req.user.role === 'admin');
    res.json({ calendars });
  },

  async getOne(req, res) {
    const calendar = await ChronologyModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!calendar) return res.status(404).json({ message: 'Календар не знайдено' });
    res.json({ calendar });
  },

  async create(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const calendar = await ChronologyModel.create(req.user.sub, req.body);
    res.status(201).json({ calendar });
  },

  async update(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });

    if (req.body.default_month_id && !await ChronologyModel.monthBelongsToCalendar(req.body.default_month_id, req.params.id)) {
      return res.status(400).json({ message: 'default_month_id має належати цьому календарю' });
    }

    const calendar = await ChronologyModel.update(req.params.id, req.body);
    if (!calendar) return res.status(404).json({ message: 'Календар не знайдено' });
    res.json({ calendar });
  },

  async remove(req, res) {
    const deleted = await ChronologyModel.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Календар не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = ChronologyController;
