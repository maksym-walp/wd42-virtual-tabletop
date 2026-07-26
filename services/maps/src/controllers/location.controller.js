const LocationModel = require('../models/location.model');
const { canCreate, canWriteLocation, isAdmin, stripGmNote } = require('./access');
const { isAllowedImageUrl } = require('../utils/image-url');

// A marker icon is either an image URL (uploaded / external / legacy preset) or
// a short emoji glyph.
const MARKER_ICON_URL_PREFIXES = ['/uploads/', '/map-markers/', 'https://'];
function isAllowedMarkerIcon(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) return false;
  if (MARKER_ICON_URL_PREFIXES.some((p) => value.startsWith(p))) return true;
  // Otherwise treat it as an emoji: short and not a path.
  return value.length <= 16 && !value.includes('/') && !value.includes('\\');
}

// Type keys are defined by the frontend config (public/map-markers/types.json),
// so the server no longer whitelists them — it only guards the column width.
const MAX_LOCATION_IMAGES = 12;

function validateOptionalFields({ type, image_urls, marker_icon, marker_level }) {
  if (type !== undefined && type !== null && (typeof type !== 'string' || type.length > 50)) {
    return 'Некоректний тип';
  }
  if (image_urls !== undefined && image_urls !== null) {
    if (!Array.isArray(image_urls)) return 'image_urls має бути масивом';
    if (image_urls.length > MAX_LOCATION_IMAGES) return `Забагато зображень (максимум ${MAX_LOCATION_IMAGES})`;
    if (image_urls.some((u) => !isAllowedImageUrl(u))) return 'Некоректне посилання на зображення';
  }
  if (marker_icon !== undefined && marker_icon !== null && marker_icon !== '' && !isAllowedMarkerIcon(marker_icon)) {
    return 'Некоректне посилання на іконку мітки';
  }
  if (marker_level !== undefined && marker_level !== null
      && (!Number.isInteger(marker_level) || marker_level < 1 || marker_level > 4)) {
    return 'Рівень мітки має бути цілим числом від 1 до 4';
  }
  return null;
}

function toModelFields(body) {
  return {
    name: body.name.trim(),
    description: body.description ?? null,
    gmNote: body.gm_note ?? null,
    imageUrls: Array.isArray(body.image_urls) ? body.image_urls : [],
    type: body.type ?? null,
    markerIcon: body.marker_icon || null,
    markerLevel: body.marker_level ?? null,
  };
}

const LocationController = {
  // The owner's location library (for authoring / pin placement).
  async listMine(req, res) {
    const locations = await LocationModel.listByOwner(req.user.sub);
    res.json({ locations });
  },

  async create(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати локації' });
    }
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    const fieldError = validateOptionalFields(req.body);
    if (fieldError) return res.status(400).json({ message: fieldError });

    const location = await LocationModel.create({ createdBy: req.user.sub, ...toModelFields(req.body) });
    res.status(201).json({ location });
  },

  async getOne(req, res) {
    const location = await LocationModel.findById(req.params.id);
    if (!location) return res.status(404).json({ message: 'Локацію не знайдено' });

    // Owner/admin see everything (incl. gm_note); other users may read only if
    // the location is pinned on a map they can read, and never see gm_note.
    const elevated = canWriteLocation(location, req.user);
    const readable = elevated
      || await LocationModel.isPinnedOnReadableMap(location.id, req.user.sub, isAdmin(req.user));
    if (!readable) return res.status(403).json({ message: 'Доступ заборонено' });

    res.json({ location: stripGmNote(location, elevated) });
  },

  async update(req, res) {
    const existing = await LocationModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Локацію не знайдено' });
    if (!canWriteLocation(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    const fieldError = validateOptionalFields(req.body);
    if (fieldError) return res.status(400).json({ message: fieldError });

    const location = await LocationModel.update(existing.id, toModelFields(req.body));
    res.json({ location });
  },

  async remove(req, res) {
    const existing = await LocationModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Локацію не знайдено' });
    if (!canWriteLocation(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    await LocationModel.remove(existing.id);
    res.status(204).send();
  },
};

module.exports = LocationController;
