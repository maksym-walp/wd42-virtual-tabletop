import api from './client';

const profileApi = {
  // Aggregated public activity for a user, by username. Returns
  // { username, characters, equipment, spells, abilities, maneuvers, collections }.
  async getPublicProfile(username) {
    const { data } = await api.get(`/api/profile/u/${encodeURIComponent(username)}`);
    return data;
  },
};

export default profileApi;
