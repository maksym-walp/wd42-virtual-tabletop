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

  // Image layers ("lenses").
  async listLenses(mapId) {
    const { data } = await api.get(`${BASE}/${mapId}/lenses`);
    return data.lenses;
  },

  async addLens(mapId, payload) {
    const { data } = await api.post(`${BASE}/${mapId}/lenses`, payload);
    return data.lens;
  },

  async removeLens(mapId, lensId) {
    await api.delete(`${BASE}/${mapId}/lenses/${lensId}`);
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

  async removePin(mapId, pinId) {
    await api.delete(`${BASE}/${mapId}/pins/${pinId}`);
  },

  // Locations (the owner's reusable lore library).
  async listLocations() {
    const { data } = await api.get(`${BASE}/locations`);
    return data.locations;
  },

  // Full location; the server includes gm_note only for the owner/admin.
  async getLocation(locationId) {
    const { data } = await api.get(`${BASE}/locations/${locationId}`);
    return data.location;
  },

  async createLocation(payload) {
    const { data } = await api.post(`${BASE}/locations`, payload);
    return data.location;
  },

  async updateLocation(locationId, payload) {
    const { data } = await api.patch(`${BASE}/locations/${locationId}`, payload);
    return data.location;
  },

  async removeLocation(locationId) {
    await api.delete(`${BASE}/locations/${locationId}`);
  },
};

export default mapsApi;
