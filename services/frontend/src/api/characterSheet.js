import api from './client';

const BASE = '/api/characters';

const characterApi = {
  // Characters
  async list() {
    const { data } = await api.get(BASE + '/');
    return data.characters;
  },

  async listCommunity({ limit } = {}) {
    const { data } = await api.get(`${BASE}/community`, { params: { limit } });
    return data.characters;
  },

  async create(payload) {
    const { data } = await api.post(BASE + '/', payload);
    return data.character;
  },

  async getSheet(id) {
    const { data } = await api.get(`${BASE}/${id}`);
    return data;
  },

  async getPublicSheet(id) {
    const { data } = await api.get(`${BASE}/public/${id}`);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`${BASE}/${id}`, payload);
    return data.character;
  },

  async remove(id) {
    await api.delete(`${BASE}/${id}`);
  },

  // Skills
  async patchSkill(characterId, skillKey, payload) {
    const { data } = await api.patch(`${BASE}/${characterId}/skills/${skillKey}`, payload);
    return data.skill;
  },

  async bulkUpdateSkills(characterId, updates) {
    const { data } = await api.put(`${BASE}/${characterId}/skills`, { updates });
    return data.skills;
  },

  // Spells
  async listSpells(characterId) {
    const { data } = await api.get(`${BASE}/${characterId}/spells`);
    return data.spells;
  },

  async addSpell(characterId, spellId) {
    const { data } = await api.post(`${BASE}/${characterId}/spells`, { spell_id: spellId });
    return data.spell;
  },

  async patchSpell(characterId, spellId, payload) {
    const { data } = await api.patch(`${BASE}/${characterId}/spells/${spellId}`, payload);
    return data.spell;
  },

  async removeSpell(characterId, spellId) {
    await api.delete(`${BASE}/${characterId}/spells/${spellId}`);
  },

  // Tree progress
  async getTree(characterId) {
    const { data } = await api.get(`${BASE}/${characterId}/tree`);
    return data.progress;
  },

  async unlockNode(characterId, nodeId) {
    const { data } = await api.post(`${BASE}/${characterId}/tree/${nodeId}`);
    return data.progress;
  },

  async lockNode(characterId, nodeId) {
    await api.delete(`${BASE}/${characterId}/tree/${nodeId}`);
  },

  // Nephilim breakthroughs
  async getBreakthroughs(characterId) {
    const { data } = await api.get(`${BASE}/${characterId}/tree/breakthroughs`);
    return data.breakthroughs;
  },

  async useBreakthrough(characterId, nodeId) {
    const { data } = await api.post(`${BASE}/${characterId}/tree/breakthroughs/${nodeId}`);
    return data.node_id;
  },

  async revokeBreakthrough(characterId, nodeId) {
    await api.delete(`${BASE}/${characterId}/tree/breakthroughs/${nodeId}`);
  },

  // Equipment (references equipment.items catalog)
  async listEquipment(characterId) {
    const { data } = await api.get(`${BASE}/${characterId}/equipment`);
    return data.equipment;
  },

  async addEquipment(characterId, equipmentId) {
    const { data } = await api.post(`${BASE}/${characterId}/equipment`, { equipment_id: equipmentId });
    return data.item;
  },

  async patchEquipment(characterId, equipmentId, payload) {
    const { data } = await api.patch(`${BASE}/${characterId}/equipment/${equipmentId}`, payload);
    return data.item;
  },

  async removeEquipment(characterId, equipmentId) {
    await api.delete(`${BASE}/${characterId}/equipment/${equipmentId}`);
  },

  // Maneuvers (fighter) — references maneuvers.entries catalog
  async listManeuvers(characterId) {
    const { data } = await api.get(`${BASE}/${characterId}/maneuvers`);
    return data.maneuvers;
  },

  async addManeuver(characterId, maneuverId) {
    const { data } = await api.post(`${BASE}/${characterId}/maneuvers`, { maneuver_id: maneuverId });
    return data.maneuver;
  },

  async removeManeuver(characterId, maneuverId) {
    await api.delete(`${BASE}/${characterId}/maneuvers/${maneuverId}`);
  },

  // Abilities (вміння, all archetypes) — references abilities.entries catalog
  async listAbilities(characterId) {
    const { data } = await api.get(`${BASE}/${characterId}/abilities`);
    return data.abilities;
  },

  async addAbility(characterId, abilityId) {
    const { data } = await api.post(`${BASE}/${characterId}/abilities`, { ability_id: abilityId });
    return data.ability;
  },

  async removeAbility(characterId, abilityId) {
    await api.delete(`${BASE}/${characterId}/abilities/${abilityId}`);
  },

  // Ritual trackers (spellcaster)
  async listRituals(characterId) {
    const { data } = await api.get(`${BASE}/${characterId}/rituals`);
    return data.trackers;
  },

  async addRitual(characterId, payload) {
    const { data } = await api.post(`${BASE}/${characterId}/rituals`, payload);
    return data.tracker;
  },

  async updateRitual(characterId, trackerId, payload) {
    const { data } = await api.put(`${BASE}/${characterId}/rituals/${trackerId}`, payload);
    return data.tracker;
  },

  async removeRitual(characterId, trackerId) {
    await api.delete(`${BASE}/${characterId}/rituals/${trackerId}`);
  },
};

export default characterApi;
