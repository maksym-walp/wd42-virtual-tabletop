import api from './client';

const BASE = '/api/compendium';

// Вікі-довідник: види/підвиди/раси/народи — власні + публічні (адміну видно
// все), запис обмежений роллю game_master/admin на сервері. Кожен запис несе
// is_owner. НІПи — api/npcs.js, істоти — api/bestiary.js.
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
  async setSpeciesOwner(id, ownerUsername) {
    const { data } = await api.patch(`${BASE}/species/${id}/owner`, { owner_username: ownerUsername });
    return data.species;
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
  async setSubspeciesOwner(id, ownerUsername) {
    const { data } = await api.patch(`${BASE}/subspecies/${id}/owner`, { owner_username: ownerUsername });
    return data.subspecies;
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
  async setRaceOwner(id, ownerUsername) {
    const { data } = await api.patch(`${BASE}/races/${id}/owner`, { owner_username: ownerUsername });
    return data.race;
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
  async setPeopleOwner(id, ownerUsername) {
    const { data } = await api.patch(`${BASE}/peoples/${id}/owner`, { owner_username: ownerUsername });
    return data.people;
  },
};

export default compendiumApi;
