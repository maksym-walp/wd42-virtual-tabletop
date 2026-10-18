const { canRead, canWrite, isAdmin } = require('./access');
const { ValidationError, requireText, cleanText, requireObject } = require('../lib/validation');

const MAX_IMPORT_ITEMS = 50;

// Спільна частина контролерів документів (сузір'я, колоди).
//   model       — createDocumentModel(...)
//   type        — тег у файлі експорту ('constellation' | 'deck')
//   label       — назви для повідомлень { notFound, deleted }
//   prepare     — (body) => очищені поля запису ({ data, ...extra });
//                 кидає ValidationError
//   exportExtra — (item) => додаткові поля файлу експорту
function createDocumentController({ model, type, label, prepare, exportExtra = () => ({}) }) {
  // Спільні поля + специфічні для інструмента. name/description тут, решту дає prepare.
  function buildFields(body) {
    const source = requireObject(body ?? {}, 'Тіло запиту');
    return {
      name: requireText(source.name, 200, 'Назва'),
      description: cleanText(source.description, 5000, 'Опис') || null,
      ...prepare(source),
    };
  }

  // Відповідає 400 сам і повертає null, якщо дані не пройшли валідацію.
  function fieldsOr400(body, res) {
    try {
      return buildFields(body);
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      res.status(400).json({ message: err.message });
      return null;
    }
  }

  // Документ, який користувач має право читати, або 404 (існування чужого
  // приватного документа не розкриваємо).
  async function loadReadableOr404(req, res) {
    const item = await model.findById(req.params.id, req.user.sub);
    if (!item || !canRead(item, req.user)) {
      res.status(404).json({ message: label.notFound });
      return null;
    }
    return item;
  }

  return {
    async list(req, res) {
      const { scope, search } = req.query;
      const items = await model.findAll(req.user.sub, { scope, search }, isAdmin(req.user));
      res.json({ items });
    },

    async get(req, res) {
      const item = await loadReadableOr404(req, res);
      if (item) res.json({ item });
    },

    async create(req, res) {
      const fields = fieldsOr400(req.body, res);
      if (!fields) return;
      const item = await model.create(req.user.sub, { ...fields, is_public: req.body.is_public === true });
      res.status(201).json({ item });
    },

    async update(req, res) {
      const existing = await loadReadableOr404(req, res);
      if (!existing) return;
      if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Forbidden' });

      const fields = fieldsOr400(req.body, res);
      if (!fields) return;
      const isPublic = typeof req.body.is_public === 'boolean' ? req.body.is_public : existing.is_public;
      const item = await model.update(existing.id, { ...fields, is_public: isPublic });
      res.json({ item });
    },

    async remove(req, res) {
      const existing = await loadReadableOr404(req, res);
      if (!existing) return;
      if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Forbidden' });
      await model.remove(existing.id);
      res.json({ message: label.deleted });
    },

    // Файл без id/власника/публічності — лише те, що має сенс у чужій
    // інсталяції. `type` дозволяє імпорту відрізнити сузір'я від колоди.
    async export(req, res) {
      const item = await loadReadableOr404(req, res);
      if (!item) return;
      res.json({
        type,
        name: item.name,
        description: item.description,
        ...exportExtra(item),
        data: item.data,
      });
    },

    // Приймає один файл експорту або масив. Спершу валідуємо все, тоді
    // вставляємо — щоб кривий запис не лишив половину імпорту.
    async import(req, res) {
      const body = req.body;
      const entries = Array.isArray(body) ? body : [body];
      if (entries.length === 0 || entries.length > MAX_IMPORT_ITEMS) {
        return res.status(400).json({ message: `Очікується від 1 до ${MAX_IMPORT_ITEMS} записів` });
      }

      let prepared;
      try {
        prepared = entries.map((entry, i) => {
          const source = requireObject(entry, `Запис №${i + 1}`);
          if (source.type != null && source.type !== type) {
            throw new ValidationError(`Запис №${i + 1}: це не ${label.what} (type: ${source.type})`);
          }
          return buildFields(source);
        });
      } catch (err) {
        if (!(err instanceof ValidationError)) throw err;
        return res.status(400).json({ message: err.message });
      }

      // Імпортоване завжди приватне: власник сам вирішує, що публікувати.
      const items = [];
      for (const fields of prepared) {
        items.push(await model.create(req.user.sub, { ...fields, is_public: false }));
      }
      res.status(201).json({ imported: items.length, items });
    },
  };
}

module.exports = createDocumentController;
