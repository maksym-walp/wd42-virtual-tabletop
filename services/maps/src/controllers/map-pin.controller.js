const MapPinModel = require('../models/map-pin.model');
const LocationModel = require('../models/location.model');
const MapLensModel = require('../models/map-lens.model');
const { canReadMap, canWriteMap, canWriteLocation, loadMapOr404, isCampaignMember } = require('./access');

const DEFAULT_MIN_ZOOM = 0;
const DEFAULT_MAX_ZOOM = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Normalized coordinate: a finite number in [0, 1].
function isValidCoord(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

// Returns the zoom int, `fallback` when omitted, or NaN when malformed.
function normalizeZoom(v, fallback) {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) return NaN;
  return v;
}

function readCoords(body) {
  const { x_coordinate, y_coordinate, min_zoom, max_zoom } = body;
  if (!isValidCoord(x_coordinate) || !isValidCoord(y_coordinate)) {
    return { error: 'Координати мають бути числом у межах 0..1' };
  }
  const minZoom = normalizeZoom(min_zoom, DEFAULT_MIN_ZOOM);
  const maxZoom = normalizeZoom(max_zoom, DEFAULT_MAX_ZOOM);
  if (Number.isNaN(minZoom) || Number.isNaN(maxZoom) || minZoom > maxZoom) {
    return { error: 'Некоректний діапазон zoom (min_zoom <= max_zoom, цілі >= 0)' };
  }
  return { value: { x: x_coordinate, y: y_coordinate, minZoom, maxZoom } };
}

// Both lens_ids and visible_campaign_ids are plain arrays of UUID strings,
// omitted entirely meaning "no restriction" ([] — see the migration).
// visible_campaign_ids is a cross-service id array (campaigns.campaigns),
// so — same trust level as campaign_characters.character_id elsewhere in
// the repo — only its *shape* is validated here, not that each id exists.
function readIdArray(value, fieldLabel) {
  if (value === undefined) return { value: [] };
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string' && UUID_RE.test(v))) {
    return { error: `${fieldLabel} має бути масивом UUID` };
  }
  return { value };
}

const MapPinController = {
  async list(req, res) {
    const map = await loadMapOr404(req.params.mapId, res);
    if (!map) return;
    if (!canReadMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    // The map owner/admin ("GM" for a standalone map) sees every pin
    // unfiltered, including its full visible_campaign_ids, so they can see
    // which campaigns each pin belongs to. Anyone else only sees pins with
    // no campaign restriction, plus — if ?campaign_id names a campaign
    // they're actually a member of — pins scoped to that campaign too.
    if (canWriteMap(map, req.user)) {
      const pins = await MapPinModel.listByMap(map.id);
      return res.json({ pins });
    }

    const campaignId = req.query.campaign_id || null;
    const verifiedCampaignId = campaignId && await isCampaignMember(campaignId, req.user.sub)
      ? campaignId
      : null;
    const pins = await MapPinModel.listVisibleToPlayer(map.id, verifiedCampaignId);
    res.json({ pins });
  },

  async add(req, res) {
    const map = await loadMapOr404(req.params.mapId, res);
    if (!map) return;
    if (!canWriteMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { location_id } = req.body;
    if (!location_id) return res.status(400).json({ message: 'location_id є обовʼязковим' });

    const coords = readCoords(req.body);
    if (coords.error) return res.status(400).json({ message: coords.error });

    const lensIds = readIdArray(req.body.lens_ids, 'lens_ids');
    if (lensIds.error) return res.status(400).json({ message: lensIds.error });
    const visibleCampaignIds = readIdArray(req.body.visible_campaign_ids, 'visible_campaign_ids');
    if (visibleCampaignIds.error) return res.status(400).json({ message: visibleCampaignIds.error });

    // You may only pin a location you own (or admin) onto your map.
    const location = await LocationModel.findById(location_id);
    if (!location || !canWriteLocation(location, req.user)) {
      return res.status(400).json({ message: 'Локацію не знайдено або немає доступу' });
    }

    if (lensIds.value.length > 0) {
      const lensCheck = await assertLensesBelongToMap(lensIds.value, map.id);
      if (lensCheck.error) return res.status(400).json({ message: lensCheck.error });
    }

    const pin = await MapPinModel.add(map.id, {
      locationId: location_id, ...coords.value,
      lensIds: lensIds.value, visibleCampaignIds: visibleCampaignIds.value,
    });
    res.status(201).json({ pin });
  },

  async update(req, res) {
    const map = await loadMapOr404(req.params.mapId, res);
    if (!map) return;
    if (!canWriteMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const coords = readCoords(req.body);
    if (coords.error) return res.status(400).json({ message: coords.error });

    const lensIds = readIdArray(req.body.lens_ids, 'lens_ids');
    if (lensIds.error) return res.status(400).json({ message: lensIds.error });
    const visibleCampaignIds = readIdArray(req.body.visible_campaign_ids, 'visible_campaign_ids');
    if (visibleCampaignIds.error) return res.status(400).json({ message: visibleCampaignIds.error });

    if (lensIds.value.length > 0) {
      const lensCheck = await assertLensesBelongToMap(lensIds.value, map.id);
      if (lensCheck.error) return res.status(400).json({ message: lensCheck.error });
    }

    const pin = await MapPinModel.update(req.params.pinId, map.id, {
      ...coords.value, lensIds: lensIds.value, visibleCampaignIds: visibleCampaignIds.value,
    });
    if (!pin) return res.status(404).json({ message: 'Мітку не знайдено' });
    res.json({ pin });
  },

  async remove(req, res) {
    const map = await loadMapOr404(req.params.mapId, res);
    if (!map) return;
    if (!canWriteMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const removed = await MapPinModel.remove(req.params.pinId, map.id);
    if (!removed) return res.status(404).json({ message: 'Мітку не знайдено' });
    res.status(204).send();
  },
};

// lens_ids is same-schema (unlike visible_campaign_ids), so — mirroring the
// calendar service's start_month_id-belongs-to-calendar check — it CAN be
// validated to actually belong to this map, not just be UUID-shaped.
async function assertLensesBelongToMap(lensIds, mapId) {
  const lenses = await MapLensModel.listByMap(mapId);
  const ownLensIds = new Set(lenses.map((l) => l.id));
  const unknown = lensIds.filter((id) => !ownLensIds.has(id));
  if (unknown.length > 0) return { error: 'lens_ids має містити лише шари цієї мапи' };
  return {};
}

module.exports = MapPinController;
