const MapModel = require('../models/map.model');

// Standalone maps: no campaign coupling. Access is owner + public + role-based,
// mirroring the artifacts/spellbook catalog pattern (created_by + is_public).

function isAdmin(user) {
  return user.role === 'admin';
}

// Only game masters and admins may create maps and locations.
function canCreate(user) {
  return user.role === 'game_master' || isAdmin(user);
}

// Map read: owner, public, or admin. Map write: owner or admin.
function canReadMap(map, user) {
  return map.created_by === user.sub || map.is_public || isAdmin(user);
}
function canWriteMap(map, user) {
  return map.created_by === user.sub || isAdmin(user);
}

// Location write AND gm_note visibility: owner or admin.
function canWriteLocation(location, user) {
  return location.created_by === user.sub || isAdmin(user);
}

// Returns the row untouched for elevated viewers; otherwise omits gm_note.
function stripGmNote(row, elevated) {
  if (elevated) return row;
  const { gm_note, ...rest } = row;
  return rest;
}

// Loads a map or answers 404 itself and returns null.
// Usage: `const map = await loadMapOr404(mapId, res); if (!map) return;`
async function loadMapOr404(mapId, res) {
  const map = await MapModel.findById(mapId);
  if (!map) { res.status(404).json({ message: 'Мапу не знайдено' }); return null; }
  return map;
}

module.exports = {
  isAdmin,
  canCreate,
  canReadMap,
  canWriteMap,
  canWriteLocation,
  stripGmNote,
  loadMapOr404,
};
