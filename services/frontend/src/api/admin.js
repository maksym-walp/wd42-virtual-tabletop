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

  async updateUserRole(id, role) {
    const { data } = await api.patch(`${BASE}/users/${id}/role`, { role });
    return data.user;
  },

  // Повертає { blob, filename } — ім'я файлу з Content-Disposition бекенда.
  async downloadBackup() {
    const res = await api.get(`${BASE}/backup`, { responseType: 'blob' });
    const match = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '');
    return { blob: res.data, filename: match?.[1] || 'walp-backup.zip' };
  },

  async restoreBackup(files) {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    const { data } = await api.post(`${BASE}/backup/restore`, form);
    return data;
  },
};

export default adminApi;
