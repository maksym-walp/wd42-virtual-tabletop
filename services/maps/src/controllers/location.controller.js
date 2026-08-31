const LocationModel = require('../models/location.model');
const LocationVersionModel = require('../models/location-version.model');
const { canCreate, canWriteLocation, isAdmin, serializeLocation } = require('./access');
const { isAllowedImageUrl } = require('../utils/image-url');
const { parseYear } = require('../utils/year');

// A marker icon is either an image URL (uploaded / external / legacy preset) or
// a short emoji glyph.
const MARKER_ICON_URL_PREFIXES = ['/uploads/', '/map-markers/', 'https://'];
function isAllowedMarkerIcon(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) return false;
  if (MARKER_ICON_URL_PREFIXES.some((p) => value.startsWith(p))) return true;
  // Otherwise treat it as an emoji: short and not a path.
  return value.length <= 16 && !value.includes('/') && !value.includes('\\');
}

function isValidMarkerLevel(value) {
  return value === undefined || value === null
    || (Number.isInteger(value) && value >= 1 && value <= 4);
}

// Type keys are free-form strings (no server whitelist) — only the count and
// per-key length are guarded. -> { value: string[] | null } | { error }.
// undefined/null -> { value: null } (inherit / omitted); an array (even []) is
// an explicit set.
function cleanTypes(value) {
  if (value === undefined || value === null) return { value: null };
  if (!Array.isArray(value)) return { error: 'types має бути масивом' };
  const clean = [];
  for (const t of value) {
    if (typeof t !== 'string' || t.length > 50) return { error: 'Некоректний тип' };
    const trimmed = t.trim();
    if (trimmed && !clean.includes(trimmed)) clean.push(trimmed);
  }
  return { value: clean };
}

function validateBaseFields({ marker_icon, marker_level, types }) {
  if (marker_icon !== undefined && marker_icon !== null && marker_icon !== '' && !isAllowedMarkerIcon(marker_icon)) {
    return 'Некоректне посилання на іконку мітки';
  }
  if (!isValidMarkerLevel(marker_level)) {
    return 'Рівень мітки має бути цілим числом від 1 до 4';
  }
  const cleaned = cleanTypes(types);
  if (cleaned.error) return cleaned.error;
  return null;
}

// Validates one chronological version. name / marker_icon / marker_level /
// types are optional per-version overrides (null = inherit the base location).
// end_year is the year the version stops applying (null = open-ended).
// -> { value: { startYear, endYear, description, gmNote, imageUrl, name,
// markerIcon, markerLevel, types } } or { error }.
function readVersionFields(body) {
  const start = parseYear(body.start_year);
  if (start.error) return { error: start.error };
  const end = parseYear(body.end_year);
  if (end.error) return { error: end.error };
  if (start.value !== null && end.value !== null && start.value > end.value) {
    return { error: 'Рік завершення не може бути раніше за рік початку' };
  }
  if (body.image_url !== undefined && body.image_url !== null && body.image_url !== ''
      && !isAllowedImageUrl(body.image_url)) {
    return { error: 'Некоректне посилання на зображення' };
  }
  if (body.name !== undefined && body.name !== null && body.name !== ''
      && (typeof body.name !== 'string' || body.name.length > 200)) {
    return { error: 'Назва задовга (максимум 200 символів)' };
  }
  if (body.marker_icon !== undefined && body.marker_icon !== null && body.marker_icon !== ''
      && !isAllowedMarkerIcon(body.marker_icon)) {
    return { error: 'Некоректне посилання на іконку мітки' };
  }
  if (!isValidMarkerLevel(body.marker_level)) {
    return { error: 'Рівень мітки має бути цілим числом від 1 до 4' };
  }
  const types = cleanTypes(body.types);
  if (types.error) return { error: types.error };
  return {
    value: {
      startYear: start.value,
      endYear: end.value,
      description: body.description ?? null,
      gmNote: body.gm_note ?? null,
      imageUrl: body.image_url || null,
      name: (typeof body.name === 'string' && body.name.trim()) ? body.name.trim() : null,
      markerIcon: body.marker_icon || null,
      markerLevel: body.marker_level ?? null,
      types: types.value,
    },
  };
}

function toBaseFields(body) {
  const types = cleanTypes(body.types);
  return {
    name: body.name.trim(),
    types: (!types.error && types.value) ? types.value : [],
    markerIcon: body.marker_icon || null,
    markerLevel: body.marker_level ?? null,
  };
}

// Fields that only exist on the server's copy — stripped from an export so the
// file is a clean "template" that round-trips through import.
const EXPORT_OMIT = ['id', 'created_by', 'created_at', 'updated_at'];
function sanitizeForExport(location) {
  const clean = { ...location };
  for (const f of EXPORT_OMIT) delete clean[f];
  // Keep gm_note (export is owner-only), drop the per-version id.
  clean.versions = (location.versions || []).map(({ id, ...rest }) => rest);
  return clean;
}

const LocationController = {
  // The owner's location library (for authoring / pin placement).
  async listMine(req, res) {
    const locations = await LocationModel.listByOwner(req.user.sub);
    res.json({ locations });
  },

  // Whole library as a JSON array, ready to feed back into POST /import.
  async export(req, res) {
    const locations = await LocationModel.listByOwner(req.user.sub);
    res.json(locations.map(sanitizeForExport));
  },

  // GM/admin only (route-gated) — bulk import of previously exported JSON.
  async import(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати локації' });
    }
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Очікується масив локацій' });
    }
    const importTypes = (raw) => {
      const c = cleanTypes(raw);
      return (!c.error && c.value) ? c.value : [];
    };
    const importYear = (raw) => (raw != null && raw !== '' && Number.isInteger(Number(raw)) ? Number(raw) : null);
    const imported = await LocationModel.bulkImport(req.user.sub, req.body, {
      toBase: (record) => ({
        name: typeof record.name === 'string' ? record.name.trim() : '',
        types: importTypes(record.types),
        markerIcon: isAllowedMarkerIcon(record.marker_icon) ? record.marker_icon : null,
        markerLevel: isValidMarkerLevel(record.marker_level) ? (record.marker_level ?? null) : null,
      }),
      toVersion: (v) => ({
        startYear: importYear(v.start_year),
        endYear: importYear(v.end_year),
        description: typeof v.description === 'string' ? v.description : null,
        gmNote: typeof v.gm_note === 'string' ? v.gm_note : null,
        name: (typeof v.name === 'string' && v.name.trim()) ? v.name.trim().slice(0, 200) : null,
        markerIcon: isAllowedMarkerIcon(v.marker_icon) ? v.marker_icon : null,
        markerLevel: isValidMarkerLevel(v.marker_level) ? (v.marker_level ?? null) : null,
        types: Array.isArray(v.types) ? importTypes(v.types) : null,
      }),
    });
    res.status(201).json({ imported });
  },

  // Creates the location plus its base (undated) version from the flattened body.
  async create(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати локації' });
    }
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    const baseError = validateBaseFields(req.body);
    if (baseError) return res.status(400).json({ message: baseError });
    const version = readVersionFields(req.body);
    if (version.error) return res.status(400).json({ message: version.error });

    const location = await LocationModel.create({ createdBy: req.user.sub, ...toBaseFields(req.body) });
    // The first version IS the base version — name/marker/types overrides live
    // on the location row, so they're never set here.
    const v = await LocationVersionModel.add(location.id, {
      ...version.value, name: null, markerIcon: null, markerLevel: null, types: null,
    });
    res.status(201).json({ location: serializeLocation(location, [v], true) });
  },

  async getOne(req, res) {
    const location = await LocationModel.findByIdWithVersions(req.params.id);
    if (!location) return res.status(404).json({ message: 'Локацію не знайдено' });

    // Owner/admin see everything (incl. gm_note); other users may read only if
    // the location is pinned on a map they can read, and never see gm_note.
    const elevated = canWriteLocation(location, req.user);
    const readable = elevated
      || await LocationModel.isPinnedOnReadableMap(location.id, req.user.sub, isAdmin(req.user));
    if (!readable) return res.status(403).json({ message: 'Доступ заборонено' });

    res.json({ location: serializeLocation(location, location.versions, elevated) });
  },

  // Base fields only — the lore is managed through the versions endpoints.
  async update(req, res) {
    const existing = await LocationModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Локацію не знайдено' });
    if (!canWriteLocation(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    const baseError = validateBaseFields(req.body);
    if (baseError) return res.status(400).json({ message: baseError });

    const location = await LocationModel.update(existing.id, toBaseFields(req.body));
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
module.exports.readVersionFields = readVersionFields;
