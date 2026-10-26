const ChronologyModel = require('../models/chronology.model');
const ChronologyMonthModel = require('../models/chronology-month.model');
const ChronologyWeekdayModel = require('../models/chronology-weekday.model');
const ChronologySeasonModel = require('../models/chronology-season.model');
const ChronologyMoonModel = require('../models/chronology-moon.model');
const ChronologyEraModel = require('../models/chronology-era.model');
const { buildCalendarExport } = require('../lib/calendar-export');

// Власні назви «День/Тиждень/Місяць/Сезон/Рік» (міграції 99, 104); порожнє = стандартна.
const TERM_KEYS = ['term_day', 'term_week', 'term_month', 'term_season', 'term_year'];

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

  // Структура календаря (без подій) у форматі для іншого рушія — див.
  // lib/calendar-export.js. Видимість — як у getOne.
  async exportStructure(req, res) {
    const calendar = await ChronologyModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!calendar) return res.status(404).json({ message: 'Календар не знайдено' });
    const [months, weekdays, seasons, moons, eras] = await Promise.all([
      ChronologyMonthModel.findAllByCalendar(calendar.id),
      ChronologyWeekdayModel.findAllByCalendar(calendar.id),
      ChronologySeasonModel.findAllByCalendar(calendar.id),
      ChronologyMoonModel.findAllByCalendar(calendar.id),
      ChronologyEraModel.findAllByCalendar(calendar.id),
    ]);
    res.json(buildCalendarExport(calendar, { months, weekdays, seasons, moons, eras }));
  },

  async create(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const calendar = await ChronologyModel.create(req.user.sub, req.body);
    res.status(201).json({ calendar });
  },

  async update(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });

    for (const key of TERM_KEYS) {
      if (req.body[key] != null && String(req.body[key]).length > 50) {
        return res.status(400).json({ message: `${key} не може бути довшим за 50 символів` });
      }
    }

    for (const key of ['week_length', 'default_day']) {
      const v = req.body[key];
      if (v != null && !(Number.isInteger(v) && v > 0)) {
        return res.status(400).json({ message: `${key} має бути додатним цілим числом` });
      }
    }
    if (req.body.week_length > 1000) {
      return res.status(400).json({ message: 'week_length не може перевищувати 1000' });
    }

    if (req.body.default_month_id && !await ChronologyModel.monthBelongsToCalendar(req.body.default_month_id, req.params.id)) {
      return res.status(400).json({ message: 'default_month_id має належати цьому календарю' });
    }

    const calendar = await ChronologyModel.update(req.params.id, req.body);
    if (!calendar) return res.status(404).json({ message: 'Календар не знайдено' });
    res.json({ calendar });
  },

  // Лише адмін (requireChronologyAdmin). Тіло { is_default: boolean }.
  async setDefault(req, res) {
    if (typeof req.body.is_default !== 'boolean') {
      return res.status(400).json({ message: 'is_default має бути boolean' });
    }
    const calendar = await ChronologyModel.setDefault(req.params.id, req.body.is_default);
    if (!calendar) return res.status(404).json({ message: 'Календар не знайдено' });
    res.json({ calendar });
  },

  // Зсув синхронізації з календарем за замовчуванням. Тіло
  // { sync_offset_days: integer | null }; null вимикає синхронізацію.
  async setSync(req, res) {
    const offset = req.body.sync_offset_days;
    if (offset !== null && !Number.isInteger(offset)) {
      return res.status(400).json({ message: 'sync_offset_days має бути цілим числом або null' });
    }
    const calendar = await ChronologyModel.findByIdRaw(req.params.id);
    if (!calendar) return res.status(404).json({ message: 'Календар не знайдено' });
    if (calendar.is_default) {
      return res.status(400).json({ message: 'Календар за замовчуванням є основою синхронізації — сам він не синхронізується' });
    }
    if (offset !== null && !await ChronologyModel.hasDefault()) {
      return res.status(400).json({ message: 'Спершу адмін має позначити календар за замовчуванням' });
    }
    const updated = await ChronologyModel.setSyncOffset(calendar.id, offset);
    res.json({ calendar: updated });
  },

  async remove(req, res) {
    const deleted = await ChronologyModel.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Календар не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = ChronologyController;
