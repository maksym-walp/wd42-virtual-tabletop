import api from './client';

const abilitiesApi = {
  async getAll() {
    const { data } = await api.get('/api/abilities/?limit=200');
    return data.abilities ?? [];
  },

  async search(query) {
    const { data } = await api.get('/api/abilities/', { params: { search: query, limit: 20 } });
    return data.abilities ?? [];
  },

  // Рівноцінні / альтернативні вміння (міграція 118) — посилання на інший,
  // самостійно заповнений запис, не форма.
  async getRelated(abilityId) {
    const { data } = await api.get(`/api/abilities/${abilityId}/related`);
    return data.related ?? [];
  },
  addRelated(abilityId, relatedId) {
    return api.post(`/api/abilities/${abilityId}/related`, { related_id: relatedId });
  },
  removeRelated(abilityId, relatedId) {
    return api.delete(`/api/abilities/${abilityId}/related/${relatedId}`);
  },
};

export default abilitiesApi;
