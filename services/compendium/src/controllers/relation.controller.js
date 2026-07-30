const EntryModel = require('../models/entry.model');
const { canWrite, isAdmin } = require('./access');

// Builds a controller for one entry -> external-catalog relation (equipment/spells/
// maneuvers). All three share the same shape — differing only in the model, the id
// field name, and how visibility of the external id is checked — so the controller
// is parameterized rather than copied three times (mirrors equipment's
// createCatalogController pattern in services/equipment/src/controllers/catalog.controller.js).
function createRelationController({ RelationModel, checkVisible, bodyField, paramField, listKey, itemKey, notFoundMessage }) {
  async function loadReadableEntry(req, res) {
    const entry = await EntryModel.findById(req.params.id, req.user.sub);
    if (!entry) { res.status(404).json({ message: 'Запис не знайдено' }); return null; }
    const readable = entry.is_public || entry.created_by === req.user.sub || isAdmin(req.user);
    if (!readable) { res.status(403).json({ message: 'Доступ заборонено' }); return null; }
    return entry;
  }

  async function loadWritableEntry(req, res) {
    const entry = await EntryModel.findById(req.params.id, req.user.sub);
    if (!entry) { res.status(404).json({ message: 'Запис не знайдено' }); return null; }
    if (!canWrite(entry, req.user)) { res.status(403).json({ message: 'Доступ заборонено' }); return null; }
    return entry;
  }

  return {
    async list(req, res) {
      const entry = await loadReadableEntry(req, res);
      if (!entry) return;
      const items = await RelationModel.findAllByEntry(entry.id);
      res.json({ [listKey]: items });
    },

    async add(req, res) {
      const entry = await loadWritableEntry(req, res);
      if (!entry) return;

      const externalId = req.body[bodyField];
      if (!externalId) return res.status(400).json({ message: `${bodyField} є обовʼязковим` });

      if (!await checkVisible(externalId, req.user.sub)) {
        return res.status(404).json({ message: notFoundMessage });
      }

      const link = await RelationModel.add(entry.id, externalId);
      res.status(201).json({ [itemKey]: link });
    },

    async remove(req, res) {
      const entry = await loadWritableEntry(req, res);
      if (!entry) return;

      const deleted = await RelationModel.remove(entry.id, req.params[paramField]);
      if (!deleted) return res.status(404).json({ message: 'Звʼязок не знайдено' });
      res.json({ message: 'Видалено' });
    },
  };
}

module.exports = createRelationController;
