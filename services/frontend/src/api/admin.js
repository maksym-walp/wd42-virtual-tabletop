import api from './client';

const BASE = '/api/admin';

const adminApi = {
  async listConfigs() {
    const { data } = await api.get(`${BASE}/configs`);
    return data.configs;
  },

  async updateConfig(key, value) {
    const { data } = await api.put(`${BASE}/configs/${key}`, { value });
    return data.config;
  },

  async listUsers() {
    const { data } = await api.get(`${BASE}/users`);
    return data.users;
  },
};

export default adminApi;
