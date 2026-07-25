const LocationModel = require('../models/location.model');
const { canCreate, canWriteLocation, isAdmin, stripGmNote } = require('./access');
const { isAllowedImageUrl } = require('../utils/image-url');

// Type keys are defined by the frontend config (public/map-markers/types.json),
// so the server no longer whitelists them — it only guards the column width.
function validateOptionalFields({ type, image_url }) {
  if (type !== undefined && type !== null && (typeof type !== 'string' || type.length > 50)) {
    return 'Некоректний тип';
  }
  if (image_url !== undefined && image_url !== null && image_url !== '' && !isAllowedImageUrl(image_url)) {
    return 'Некоректне посилання на зображення';
  }
  return null;
}

function toModelFields(body) {
  return {
    name: body.name.trim(),
    description: body.description ?? null,
    gmNote: body.gm_note ?? null,
    imageUrl: body.image_url || null,
    type: body.type ?? null,
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
