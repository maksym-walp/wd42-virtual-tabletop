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

  // Races
  async listRaces() {
    const { data } = await api.get(`${BASE}/races`);
    return data.races;
  },
  async getRace(id) {
    const { data } = await api.get(`${BASE}/races/${id}`);
    return data.race;
  },
  async createRace(payload) {
    const { data } = await api.post(`${BASE}/races`, payload);
    return data.race;
  },
  async updateRace(id, payload) {
    const { data } = await api.patch(`${BASE}/races/${id}`, payload);
    return data.race;
  },
  async removeRace(id) {
    await api.delete(`${BASE}/races/${id}`);
  },

  // Peoples
  async listPeoples(raceId) {
    const qs = raceId ? `?race_id=${raceId}` : '';
    const { data } = await api.get(`${BASE}/peoples${qs}`);
    return data.peoples;
  },
  async getPeople(id) {
    const { data } = await api.get(`${BASE}/peoples/${id}`);
    return data.people;
  },
  async createPeople(payload) {
    const { data } = await api.post(`${BASE}/peoples`, payload);
    return data.people;
  },
  async updatePeople(id, payload) {
    const { data } = await api.patch(`${BASE}/peoples/${id}`, payload);
    return data.people;
  },
  async removePeople(id) {
    await api.delete(`${BASE}/peoples/${id}`);
  },

  // Factions
  async listFactions() {
    const { data } = await api.get(`${BASE}/factions`);
    return data.factions;
  },
  async getFaction(id) {
    const { data } = await api.get(`${BASE}/factions/${id}`);
    return data.faction;
  },
  async createFaction(payload) {
    const { data } = await api.post(`${BASE}/factions`, payload);
    return data.faction;
  },
  async updateFaction(id, payload) {
    const { data } = await api.patch(`${BASE}/factions/${id}`, payload);
    return data.faction;
  },
  async removeFaction(id) {
    await api.delete(`${BASE}/factions/${id}`);
  },

  async listFactionLeaders(factionId) {
    const { data } = await api.get(`${BASE}/factions/${factionId}/leaders`);
    return data.leaders;
  },
  async addFactionLeader(factionId, npcEntryId) {
    const { data } = await api.post(`${BASE}/factions/${factionId}/leaders`, { npc_entry_id: npcEntryId });
    return data.leader;
  },
  async removeFactionLeader(factionId, npcEntryId) {
    await api.delete(`${BASE}/factions/${factionId}/leaders/${npcEntryId}`);
  },

  async listFactionMembers(factionId) {
    const { data } = await api.get(`${BASE}/factions/${factionId}/members`);
    return data.members;
  },
  async addFactionMember(factionId, memberType, memberId) {
    const { data } = await api.post(`${BASE}/factions/${factionId}/members`, { member_type: memberType, member_id: memberId });
    return data.member;
  },
  async removeFactionMember(factionId, memberType, memberId) {
    await api.delete(`${BASE}/factions/${factionId}/members/${memberType}/${memberId}`);
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

  // Cross-service relations: equipment loadout, known spells, known abilities.
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

  async listEntryAbilities(entryId) {
    const { data } = await api.get(`${BASE}/entries/${entryId}/abilities`);
    return data.abilities;
  },
  async addEntryAbility(entryId, abilityId) {
    const { data } = await api.post(`${BASE}/entries/${entryId}/abilities`, { ability_id: abilityId });
    return data.ability;
  },
  async removeEntryAbility(entryId, abilityId) {
    await api.delete(`${BASE}/entries/${entryId}/abilities/${abilityId}`);
  },
};

export default compendiumApi;
