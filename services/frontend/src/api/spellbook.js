import api from './client';

const spellbookApi = {
  async getAll() {
    const { data } = await api.get('/api/spellbook/?limit=200');
    return data.spells ?? [];
  },

  async search(query) {
    const { data } = await api.get('/api/spellbook/', { params: { search: query, limit: 20 } });
    return data.spells ?? [];
  },

  // Рівноцінні / альтернативні заклинання (міграція 118) — посилання на
  // інший, самостійно заповнений запис, не форма.
  async getRelated(spellId) {
    const { data } = await api.get(`/api/spellbook/${spellId}/related`);
    return data.related ?? [];
  },
  addRelated(spellId, relatedId) {
    return api.post(`/api/spellbook/${spellId}/related`, { related_id: relatedId });
  },
  removeRelated(spellId, relatedId) {
    return api.delete(`/api/spellbook/${spellId}/related/${relatedId}`);
  },
};

export default spellbookApi;
