const MapLensModel = require('../models/map-lens.model');
const { canReadMap, canWriteMap, loadMapOr404 } = require('./access');
const { isAllowedImageUrl } = require('../utils/image-url');

const MapLensController = {
  async list(req, res) {
    const map = await loadMapOr404(req.params.mapId, res);
    if (!map) return;
    if (!canReadMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const lenses = await MapLensModel.listByMap(map.id);
    res.json({ lenses });
  },

  async add(req, res) {
    const map = await loadMapOr404(req.params.mapId, res);
    if (!map) return;
    if (!canWriteMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { name, image_url } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });
    if (!isAllowedImageUrl(image_url)) return res.status(400).json({ message: 'Некоректне посилання на зображення' });

    const lens = await MapLensModel.add(map.id, name.trim(), image_url);
    res.status(201).json({ lens });
  },

  async update(req, res) {
    const map = await loadMapOr404(req.params.mapId, res);
    if (!map) return;
    if (!canWriteMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { name, image_url } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });
    if (!isAllowedImageUrl(image_url)) return res.status(400).json({ message: 'Некоректне посилання на зображення' });

    const lens = await MapLensModel.update(req.params.lensId, map.id, { name: name.trim(), imageUrl: image_url });
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
