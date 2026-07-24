import api from './client';

const traditionsApi = {
  async getAll({ search } = {}) {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    const { data } = await api.get(`/api/spellbook/traditions/${qs}`);
    return data.traditions ?? [];
  },

  async getOne(id) {
    const { data } = await api.get(`/api/spellbook/traditions/${id}`);
    return data.tradition;
  },

  async create(payload) {
    const { data } = await api.post('/api/spellbook/traditions/', payload);
    return data.tradition;
  },

  async update(id, payload) {
    const { data } = await api.put(`/api/spellbook/traditions/${id}`, payload);
    return data.tradition;
  },

  async remove(id) {
    await api.delete(`/api/spellbook/traditions/${id}`);
  },

  async addSpell(traditionId, spellId) {
    const { data } = await api.post(`/api/spellbook/traditions/${traditionId}/spells`, { spell_id: spellId });
    return data.item;
  },

  async removeSpell(traditionId, spellId) {
    await api.delete(`/api/spellbook/traditions/${traditionId}/spells/${spellId}`);
  },
};

export default traditionsApi;
