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

  // Admin-only — reassigns the character to another registered user.
  async setOwner(id, ownerUsername) {
    const { data } = await api.patch(`${BASE}/${id}/owner`, { owner_username: ownerUsername });
    return data.character;
  },

  // Copies the character, optionally with a new race/archetype. See
  // CharacterModel.duplicate (backend) for what carries over — tree progress/
  // known spells/abilities/ritual trackers only come along when the archetype
  // is unchanged.
  async duplicate(id, payload) {
    const { data } = await api.post(`${BASE}/${id}/duplicate`, payload);
    return data.character;
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
    // { progress, granted: { abilities, spells } } — granted holds
    // any entries a "видавати автоматично" node link added to the sheet.
    return data;
  },

  async lockNode(characterId, nodeId) {
    await api.delete(`${BASE}/${characterId}/tree/${nodeId}`);
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
