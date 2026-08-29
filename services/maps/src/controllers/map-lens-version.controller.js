const MapLensVersionModel = require('../models/map-lens-version.model');
const { canWriteMap, loadMapOr404, loadLensOr404 } = require('./access');
const { isAllowedImageUrl } = require('../utils/image-url');
const { parseYear } = require('../utils/year');

// Loads map + lens and runs the write gate, or writes the response and returns
// null. Usage: `const ctx = await authorize(req, res); if (!ctx) return;`
async function authorize(req, res) {
  const map = await loadMapOr404(req.params.mapId, res);
  if (!map) return null;
  if (!canWriteMap(map, req.user)) { res.status(403).json({ message: 'Доступ заборонено' }); return null; }
  const lens = await loadLensOr404(req.params.lensId, map.id, res);
  if (!lens) return null;
  return { map, lens };
}

function readBody(req, res) {
  const { image_url } = req.body;
  if (!isAllowedImageUrl(image_url)) { res.status(400).json({ message: 'Некоректне посилання на зображення' }); return null; }
  const year = parseYear(req.body.year);
  if (year.error) { res.status(400).json({ message: year.error }); return null; }
  return { imageUrl: image_url, year: year.value };
}

const MapLensVersionController = {
  async add(req, res) {
    const ctx = await authorize(req, res);
    if (!ctx) return;
    const body = readBody(req, res);
    if (!body) return;

    try {
      const version = await MapLensVersionModel.add(ctx.lens.id, body);
      res.status(201).json({ version });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ message: 'Для цього року вже є версія шару' });
      throw err;
    }
  },

  async update(req, res) {
    const ctx = await authorize(req, res);
    if (!ctx) return;
    const body = readBody(req, res);
    if (!body) return;

    try {
      const version = await MapLensVersionModel.update(req.params.versionId, ctx.lens.id, body);
      if (!version) return res.status(404).json({ message: 'Версію шару не знайдено' });
      res.json({ version });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ message: 'Для цього року вже є версія шару' });
      throw err;
    }
  },

  // Refuse to remove a lens's last version — a lens with no image can't render.
  async remove(req, res) {
    const ctx = await authorize(req, res);
    if (!ctx) return;

    const count = await MapLensVersionModel.countByLens(ctx.lens.id);
    if (count <= 1) return res.status(400).json({ message: 'Не можна видалити єдину версію шару' });

    const removed = await MapLensVersionModel.remove(req.params.versionId, ctx.lens.id);
    if (!removed) return res.status(404).json({ message: 'Версію шару не знайдено' });
    res.status(204).send();
  },
};

module.exports = MapLensVersionController;
