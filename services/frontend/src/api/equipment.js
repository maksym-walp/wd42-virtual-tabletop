import api from './client';

const equipmentApi = {
  async getAll() {
    const { data } = await api.get('/api/equipment/?limit=200');
    return data.items ?? [];
  },
};

export default equipmentApi;
