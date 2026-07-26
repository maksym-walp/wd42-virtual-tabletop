import api from './client';
import { EQUIPMENT_ENDPOINTS } from '../constants/equipment';

const equipmentApi = {
  // Корінь сервіса віддає всі три види спорядження разом — саме це й потрібно
  // пікерам, які не фільтрують за видом наперед.
  async getAll() {
    const { data } = await api.get('/api/equipment/?limit=200');
    return data.items ?? [];
  },

  // Used by the spell form's component quick-create flow — always created
  // public so other players can see the reagent, never as the creator's
  // private item. Реагент — це звичайний предмет, тож і таблиця його.
  async create(item) {
    const { data } = await api.post(EQUIPMENT_ENDPOINTS.item, { ...item, is_public: true });
    return data.item;
  },
};

export default equipmentApi;
