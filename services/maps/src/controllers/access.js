const MapModel = require('../models/map.model');
const MapLensModel = require('../models/map-lens.model');
const CampaignMembershipModel = require('../models/campaign-membership.model');

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

// Shapes a location response: the base row plus its chronological `versions`.
// gm_note lives per-version now, so it's stripped from every version for
// non-owner/non-admin viewers.
function serializeLocation(base, versions, elevated) {
  const { versions: _drop, ...rest } = base;
  return { ...rest, versions: (versions || []).map((v) => stripGmNote(v, elevated)) };
}

// Loads a map or answers 404 itself and returns null.
// Usage: `const map = await loadMapOr404(mapId, res); if (!map) return;`
async function loadMapOr404(mapId, res) {
  const map = await MapModel.findById(mapId);
  if (!map) { res.status(404).json({ message: 'Мапу не знайдено' }); return null; }
  return map;
}

// Loads a lens scoped to its map, or answers 404 and returns null. map_lenses is
// same-schema, so lens-belongs-to-map IS checkable here (unlike cross-service
// ids). Usage: `const lens = await loadLensOr404(lensId, mapId, res); if (!lens) return;`
async function loadLensOr404(lensId, mapId, res) {
  const lens = await MapLensModel.findById(lensId, mapId);
  if (!lens) { res.status(404).json({ message: 'Шар не знайдено' }); return null; }
  return lens;
}

// Every campaign this map is linked to that the user is a member (GM or
// player) of — the pin reader's "current campaigns" context, derived
// server-side so it doesn't depend on the client naming the right
// campaign_id (refresh, a bare map link, a shared link all work the same).
async function memberCampaignIdsForMap(mapId, userId) {
  return CampaignMembershipModel.memberCampaignIdsForMap(mapId, userId);
}

module.exports = {
  isAdmin,
  canCreate,
  canReadMap,
  canWriteMap,
  canWriteLocation,
  stripGmNote,
  serializeLocation,
  loadMapOr404,
  loadLensOr404,
  memberCampaignIdsForMap,
};
