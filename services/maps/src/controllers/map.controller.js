const MapModel = require('../models/map.model');
const { isAllowedImageUrl } = require('../utils/image-url');
const { canCreate, canReadMap, canWriteMap, isAdmin, loadMapOr404 } = require('./access');

function withOwner(map, user) {
  return { ...map, is_owner: map.created_by === user.sub || isAdmin(user) };
}

const MapController = {
  // Maps the user can see: own + public (admin: all).
  async list(req, res) {
    const maps = await MapModel.listVisible(req.user.sub, isAdmin(req.user));
    res.json({ maps });
  },

  async create(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати мапи' });
    }
    const { name, is_public } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    const map = await MapModel.create(req.user.sub, name.trim(), Boolean(is_public));
    res.status(201).json({ map: withOwner(map, req.user) });
  },

  async getOne(req, res) {
    const map = await loadMapOr404(req.params.id, res);
    if (!map) return;
    if (!canReadMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });
    res.json({ map: withOwner(map, req.user) });
  },

  async update(req, res) {
    const map = await loadMapOr404(req.params.id, res);
    if (!map) return;
    if (!canWriteMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const name = req.body.name ?? map.name;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });
    const isPublic = req.body.is_public === undefined ? map.is_public : Boolean(req.body.is_public);

    // Прев'ю: undefined — не чіпати, null/'' — прибрати, інакше лише наш
    // /uploads/ або https (як і зображення шарів). Мініатюра йде в парі з
    // оригіналом; без неї картки просто падають на оригінал.
    let previewImageUrl = map.preview_image_url ?? null;
    let previewThumbnailUrl = map.preview_thumbnail_url ?? null;
    if (req.body.preview_image_url !== undefined) {
      const image = req.body.preview_image_url || null;
      const thumb = req.body.preview_thumbnail_url || null;
      if ((image && !isAllowedImageUrl(image)) || (thumb && !isAllowedImageUrl(thumb))) {
        return res.status(400).json({ message: 'Некоректне посилання на зображення' });
      }
      previewImageUrl = image;
      previewThumbnailUrl = image ? thumb : null;
    }

    const updated = await MapModel.update(map.id, {
      name: name.trim(), isPublic, previewImageUrl, previewThumbnailUrl,
    });
    res.json({ map: withOwner(updated, req.user) });
  },

  async remove(req, res) {
    const map = await loadMapOr404(req.params.id, res);
    if (!map) return;
    if (!canWriteMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    await MapModel.remove(map.id);
    res.status(204).send();
  },

  // Admin-only: reassign the map's owner without changing anything else.
  async setOwner(req, res) {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { owner_username } = req.body;
    if (!owner_username || !owner_username.trim()) {
      return res.status(400).json({ message: 'owner_username є обовʼязковим' });
    }

    const updated = await MapModel.setOwner(req.params.id, owner_username.trim());
    if (!updated) {
      return res.status(404).json({ message: 'Запис не знайдено або користувача з таким іменем не існує' });
    }
    res.json({ map: withOwner(updated, req.user) });
  },
};

module.exports = MapController;
