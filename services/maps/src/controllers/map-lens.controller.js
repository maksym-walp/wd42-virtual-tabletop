const MapLensModel = require('../models/map-lens.model');
const MapLensVersionModel = require('../models/map-lens-version.model');
const { canReadMap, canWriteMap, loadMapOr404 } = require('./access');
const { isAllowedImageUrl } = require('../utils/image-url');
const { parseYear } = require('../utils/year');

const MapLensController = {
  async list(req, res) {
    const map = await loadMapOr404(req.params.mapId, res);
    if (!map) return;
    if (!canReadMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const lenses = await MapLensModel.listByMap(map.id);
    res.json({ lenses });
  },

  // Creates the lens plus its first image version. `year` is optional — omitted
  // means the version is "timeless" (year IS NULL).
  async add(req, res) {
    const map = await loadMapOr404(req.params.mapId, res);
    if (!map) return;
    if (!canWriteMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { name, image_url } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });
    if (!isAllowedImageUrl(image_url)) return res.status(400).json({ message: 'Некоректне посилання на зображення' });
    const year = parseYear(req.body.year);
    if (year.error) return res.status(400).json({ message: year.error });

    const lens = await MapLensModel.add(map.id, name.trim());
    const version = await MapLensVersionModel.add(lens.id, { year: year.value, imageUrl: image_url });
    res.status(201).json({ lens: { ...lens, versions: [{ id: version.id, year: version.year, image_url: version.image_url }] } });
  },

  // Rename only — images are managed through the versions endpoints.
  async update(req, res) {
    const map = await loadMapOr404(req.params.mapId, res);
    if (!map) return;
    if (!canWriteMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    const lens = await MapLensModel.update(req.params.lensId, map.id, { name: name.trim() });
    if (!lens) return res.status(404).json({ message: 'Шар не знайдено' });
    res.json({ lens });
  },

  async remove(req, res) {
    const map = await loadMapOr404(req.params.mapId, res);
    if (!map) return;
    if (!canWriteMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const removed = await MapLensModel.remove(req.params.lensId, map.id);
    if (!removed) return res.status(404).json({ message: 'Шар не знайдено' });
    res.status(204).send();
  },
};

module.exports = MapLensController;
