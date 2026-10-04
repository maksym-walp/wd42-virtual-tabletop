import api from './client';
import { createLoadoutApi } from './statBlockLoadout';

const BASE = '/api/bestiary/creatures';

// Істоти бестіарію — власні + публічні (адміну видно все), запис обмежений
// роллю game_master/admin на сервері. Кожна несе is_owner та обчислені
// `skills`/`health` (health.rolled завжди null — у істот немає постійного здоровʼя).
const bestiaryApi = {
  async list() {
    const { data } = await api.get(BASE);
    return data.creatures;
  },
  async get(id) {
    const { data } = await api.get(`${BASE}/${id}`);
    return data.creature;
  },
  async create(payload) {
    const { data } = await api.post(BASE, payload);
    return data.creature;
  },
  async update(id, payload) {
    const { data } = await api.patch(`${BASE}/${id}`, payload);
    return data.creature;
  },
  async remove(id) {
    await api.delete(`${BASE}/${id}`);
  },
  async setOwner(id, ownerUsername) {
    const { data } = await api.patch(`${BASE}/${id}/owner`, { owner_username: ownerUsername });
    return data.creature;
  },

  ...createLoadoutApi(BASE),
};

export default bestiaryApi;
