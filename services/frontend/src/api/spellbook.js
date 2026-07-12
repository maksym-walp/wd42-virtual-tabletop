import api from './client';

const spellbookApi = {
  async getAll() {
    const { data } = await api.get('/api/spellbook/?limit=200');
    return data.spells ?? [];
  },
};

export default spellbookApi;
