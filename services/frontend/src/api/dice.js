import api from './client';

const BASE = '/api/dice';

const diceApi = {
  async roll(formula) {
    const { data } = await api.post(`${BASE}/rolls`, { formula });
    return data.roll;
  },

  async history({ limit, offset } = {}) {
    const { data } = await api.get(`${BASE}/rolls`, { params: { limit, offset } });
    return data.rolls;
  },

  async stats() {
    const { data } = await api.get(`${BASE}/stats`);
    return data.stats;
  },
};

export default diceApi;
