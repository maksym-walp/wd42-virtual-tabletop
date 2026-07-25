const MapPinModel = require('../models/map-pin.model');
const LocationModel = require('../models/location.model');
const { canReadMap, canWriteMap, canWriteLocation, loadMapOr404 } = require('./access');

const DEFAULT_MIN_ZOOM = 0;
const DEFAULT_MAX_ZOOM = 100;

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

const MapPinController = {
  async list(req, res) {
    const map = await loadMapOr404(req.params.mapId, res);
    if (!map) return;
    if (!canReadMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const pins = await MapPinModel.listByMap(map.id);
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

    // You may only pin a location you own (or admin) onto your map.
    const location = await LocationModel.findById(location_id);
    if (!location || !canWriteLocation(location, req.user)) {
      return res.status(400).json({ message: 'Локацію не знайдено або немає доступу' });
    }

    const pin = await MapPinModel.add(map.id, { locationId: location_id, ...coords.value });
    res.status(201).json({ pin });
  },

  async update(req, res) {
    const map = await loadMapOr404(req.params.mapId, res);
    if (!map) return;
    if (!canWriteMap(map, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const coords = readCoords(req.body);
    if (coords.error) return res.status(400).json({ message: coords.error });

    const pin = await MapPinModel.update(req.params.pinId, map.id, coords.value);
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

module.exports = MapPinController;
