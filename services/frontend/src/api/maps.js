import api from './client';

const BASE = '/api/maps';

// Standalone maps service — independent of campaigns. Access is owner + public
// (created_by / is_public), creation is limited to game_master/admin on the server.
const mapsApi = {
  // Maps the user can see: their own + public (admin: all). Each carries is_owner.
  async list() {
    const { data } = await api.get(`${BASE}/`);
    return data.maps;
  },

  async getMap(id) {
    const { data } = await api.get(`${BASE}/${id}`);
    return data.map;
  },

  async create(payload) {
    const { data } = await api.post(`${BASE}/`, payload);
    return data.map;
  },

  async updateMap(id, payload) {
    const { data } = await api.patch(`${BASE}/${id}`, payload);
    return data.map;
  },

  async removeMap(id) {
    await api.delete(`${BASE}/${id}`);
  },

  // Image layers ("lenses"). Each lens carries a `versions` array
  // ([{ id, year, image_url }], oldest year first, the timeless year=null
  // version last) — its image changes over the years.
  async listLenses(mapId) {
    const { data } = await api.get(`${BASE}/${mapId}/lenses`);
    return data.lenses;
  },

  // payload: { name, image_url, year? } — creates the lens + its first version.
  async addLens(mapId, payload) {
    const { data } = await api.post(`${BASE}/${mapId}/lenses`, payload);
    return data.lens;
  },

  // payload: { name } — rename only.
  async renameLens(mapId, lensId, payload) {
    const { data } = await api.patch(`${BASE}/${mapId}/lenses/${lensId}`, payload);
    return data.lens;
  },

  async removeLens(mapId, lensId) {
    await api.delete(`${BASE}/${mapId}/lenses/${lensId}`);
  },

  // Dated image versions of a lens (the timeline). year is nullable (null =
  // "timeless" fallback image).
  async addLensVersion(mapId, lensId, payload) {
    const { data } = await api.post(`${BASE}/${mapId}/lenses/${lensId}/versions`, payload);
    return data.version;
  },

  async updateLensVersion(mapId, lensId, versionId, payload) {
    const { data } = await api.patch(`${BASE}/${mapId}/lenses/${lensId}/versions/${versionId}`, payload);
    return data.version;
  },

  async removeLensVersion(mapId, lensId, versionId) {
    await api.delete(`${BASE}/${mapId}/lenses/${lensId}/versions/${versionId}`);
  },

  // Pins carry joined location_name / location_type / location_marker_icon / location_marker_level.
  async listPins(mapId) {
    const { data } = await api.get(`${BASE}/${mapId}/pins`);
    return data.pins;
  },

  async addPin(mapId, payload) {
    const { data } = await api.post(`${BASE}/${mapId}/pins`, payload);
    return data.pin;
  },

  async updatePin(mapId, pinId, payload) {
    const { data } = await api.patch(`${BASE}/${mapId}/pins/${pinId}`, payload);
    return data.pin;
  },

  async removePin(mapId, pinId) {
    await api.delete(`${BASE}/${mapId}/pins/${pinId}`);
  },

  // Locations (the owner's reusable lore library). Each location carries a
  // `versions` array ([{ id, start_year, description, gm_note, image_url }],
  // oldest year first, the base start_year=null version last) — its lore
  // changes over the years.
  async listLocations() {
    const { data } = await api.get(`${BASE}/locations`);
    return data.locations;
  },

  // Full location incl. its versions; the server includes gm_note only for the
  // owner/admin.
  async getLocation(locationId) {
    const { data } = await api.get(`${BASE}/locations/${locationId}`);
    return data.location;
  },

  // payload: base fields ({ name, type, marker_icon, marker_level }) plus the
  // first version's fields flattened ({ start_year?, description?, gm_note?,
  // image_url? }) — the server splits them.
  async createLocation(payload) {
    const { data } = await api.post(`${BASE}/locations`, payload);
    return data.location;
  },

  // payload: base fields only ({ name, type, marker_icon, marker_level }).
  async updateLocation(locationId, payload) {
    const { data } = await api.patch(`${BASE}/locations/${locationId}`, payload);
    return data.location;
  },

  async removeLocation(locationId) {
    await api.delete(`${BASE}/locations/${locationId}`);
  },

  // Whole location library as a JSON array (base + versions), ready to feed
  // back into importLocations.
  async exportLocations() {
    const { data } = await api.get(`${BASE}/locations/export`);
    return data;
  },

  // GM/admin only. Returns { imported: <count> }.
  async importLocations(records) {
    const { data } = await api.post(`${BASE}/locations/import`, records);
    return data;
  },

  // Chronological versions of a location's lore. start_year is nullable
  // (null = the base version).
  async addLocationVersion(locationId, payload) {
    const { data } = await api.post(`${BASE}/locations/${locationId}/versions`, payload);
    return data.version;
  },

  async updateLocationVersion(locationId, versionId, payload) {
    const { data } = await api.patch(`${BASE}/locations/${locationId}/versions/${versionId}`, payload);
    return data.version;
  },

  async removeLocationVersion(locationId, versionId) {
    await api.delete(`${BASE}/locations/${locationId}/versions/${versionId}`);
  },
};

export default mapsApi;
