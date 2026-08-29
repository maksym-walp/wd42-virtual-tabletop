const LocationVersionModel = require('../models/location-version.model');
const LocationModel = require('../models/location.model');
const { canWriteLocation } = require('./access');
const { readVersionFields } = require('./location.controller');

// Loads the location and runs the write gate, or writes the response and returns
// null. Usage: `const loc = await authorize(req, res); if (!loc) return;`
async function authorize(req, res) {
  const location = await LocationModel.findById(req.params.id);
  if (!location) { res.status(404).json({ message: 'Локацію не знайдено' }); return null; }
  if (!canWriteLocation(location, req.user)) { res.status(403).json({ message: 'Доступ заборонено' }); return null; }
  return location;
}

const LocationVersionController = {
  async add(req, res) {
    const location = await authorize(req, res);
    if (!location) return;
    const fields = readVersionFields(req.body);
    if (fields.error) return res.status(400).json({ message: fields.error });

    try {
      const version = await LocationVersionModel.add(location.id, fields.value);
      res.status(201).json({ version });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ message: 'Для цього року вже є версія локації' });
      throw err;
    }
  },

  async update(req, res) {
    const location = await authorize(req, res);
    if (!location) return;
    const fields = readVersionFields(req.body);
    if (fields.error) return res.status(400).json({ message: fields.error });

    try {
      const version = await LocationVersionModel.update(req.params.versionId, location.id, fields.value);
      if (!version) return res.status(404).json({ message: 'Версію локації не знайдено' });
      res.json({ version });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ message: 'Для цього року вже є версія локації' });
      throw err;
    }
  },

  // Refuse to remove a location's last version — it must always have one.
  async remove(req, res) {
    const location = await authorize(req, res);
    if (!location) return;

    const count = await LocationVersionModel.countByLocation(location.id);
    if (count <= 1) return res.status(400).json({ message: 'Не можна видалити єдину версію локації' });

    const removed = await LocationVersionModel.remove(req.params.versionId, location.id);
    if (!removed) return res.status(404).json({ message: 'Версію локації не знайдено' });
    res.status(204).send();
  },
};

module.exports = LocationVersionController;
