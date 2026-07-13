import api from './client';

const abilitiesApi = {
  async getAll() {
    const { data } = await api.get('/api/abilities/?limit=200');
    return data.abilities ?? [];
  },
};

export default abilitiesApi;
