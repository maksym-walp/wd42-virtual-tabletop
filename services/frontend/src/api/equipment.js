import api from './client';

const equipmentApi = {
  async getAll() {
    const { data } = await api.get('/api/equipment/?limit=200');
    return data.items ?? [];
  },

  // Used by the spell form's component quick-create flow — always created
  // public so other players can see the reagent, never as the creator's
  // private item.
  async create(item) {
    const { data } = await api.post('/api/equipment/', { ...item, is_public: true });
    return data.item;
  },
};

export default equipmentApi;
