import api from './client';

const maneuversApi = {
  async getAll() {
    const { data } = await api.get('/api/maneuvers/?limit=200');
    return data.maneuvers ?? [];
  },
};

export default maneuversApi;
