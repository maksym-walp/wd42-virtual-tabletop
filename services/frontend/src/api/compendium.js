import api from './client';

const BASE = '/api/compendium';

// НІПи/бестіарій/види сервіса — власні + публічні (адміну видно все), запис
// обмежений роллю game_master/admin на сервері. Кожен запис несе is_owner.
const compendiumApi = {
  // Species
  async listSpecies() {
    const { data } = await api.get(`${BASE}/species`);
    return data.species;
  },
  async getSpecies(id) {
    const { data } = await api.get(`${BASE}/species/${id}`);
    return data.species;
  },
  async createSpecies(payload) {
    const { data } = await api.post(`${BASE}/species`, payload);
    return data.species;
  },
  async updateSpecies(id, payload) {
    const { data } = await api.patch(`${BASE}/species/${id}`, payload);
    return data.species;
  },
  async removeSpecies(id) {
    await api.delete(`${BASE}/species/${id}`);
  },

  // Subspecies
  async listSubspecies(speciesId) {
    const qs = speciesId ? `?species_id=${speciesId}` : '';
    const { data } = await api.get(`${BASE}/subspecies${qs}`);
    return data.subspecies;
  },
  async getSubspecies(id) {
    const { data } = await api.get(`${BASE}/subspecies/${id}`);
    return data.subspecies;
  },
  async createSubspecies(payload) {
    const { data } = await api.post(`${BASE}/subspecies`, payload);
    return data.subspecies;
  },
  async updateSubspecies(id, payload) {
    const { data } = await api.patch(`${BASE}/subspecies/${id}`, payload);
    return data.subspecies;
  },
  async removeSubspecies(id) {
    await api.delete(`${BASE}/subspecies/${id}`);
  },

  // Entries (NPC/Creature, STI via entity_type) — each carries a computed
  // `skills` array (dice rank per attribute-derived skill).
  async listEntries(entityType) {
    const qs = entityType ? `?entity_type=${entityType}` : '';
    const { data } = await api.get(`${BASE}/entries${qs}`);
    return data.entries;
  },
  async getEntry(id) {
    const { data } = await api.get(`${BASE}/entries/${id}`);
    return data.entry;
  },
  async createEntry(payload) {
    const { data } = await api.post(`${BASE}/entries`, payload);
    return data.entry;
  },
  async updateEntry(id, payload) {
    const { data } = await api.patch(`${BASE}/entries/${id}`, payload);
    return data.entry;
  },
  async removeEntry(id) {
    await api.delete(`${BASE}/entries/${id}`);
  },

  // Persists a rolled health-dice total — NPCs only; pass null to clear a
  // previous roll. Narrow endpoint: touches only rolled_health, unlike
  // updateEntry which rewrites the whole row from a full form submission.
  async updateEntryHealth(id, rolledHealth) {
    const { data } = await api.patch(`${BASE}/entries/${id}/health`, { rolled_health: rolledHealth });
    return data.entry;
  },

  // Cross-service relations: equipment loadout, known spells, known maneuvers.
  async listEntryEquipment(entryId) {
    const { data } = await api.get(`${BASE}/entries/${entryId}/equipment`);
    return data.equipment;
  },
  async addEntryEquipment(entryId, equipmentId) {
    const { data } = await api.post(`${BASE}/entries/${entryId}/equipment`, { equipment_id: equipmentId });
    return data.item;
  },
  async removeEntryEquipment(entryId, equipmentId) {
    await api.delete(`${BASE}/entries/${entryId}/equipment/${equipmentId}`);
  },

  async listEntrySpells(entryId) {
    const { data } = await api.get(`${BASE}/entries/${entryId}/spells`);
    return data.spells;
  },
  async addEntrySpell(entryId, spellId) {
    const { data } = await api.post(`${BASE}/entries/${entryId}/spells`, { spell_id: spellId });
    return data.spell;
  },
  async removeEntrySpell(entryId, spellId) {
    await api.delete(`${BASE}/entries/${entryId}/spells/${spellId}`);
  },

  async listEntryManeuvers(entryId) {
    const { data } = await api.get(`${BASE}/entries/${entryId}/maneuvers`);
    return data.maneuvers;
  },
  async addEntryManeuver(entryId, maneuverId) {
    const { data } = await api.post(`${BASE}/entries/${entryId}/maneuvers`, { maneuver_id: maneuverId });
    return data.maneuver;
  },
  async removeEntryManeuver(entryId, maneuverId) {
    await api.delete(`${BASE}/entries/${entryId}/maneuvers/${maneuverId}`);
  },
};

export default compendiumApi;
