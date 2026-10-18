import api from './client';

const BASE = '/api/tools';

// Сузір'я й колоди мають однакове API (див. services/tools/README.md), тож
// клієнт для обох будується однією фабрикою.
function createDocumentApi(path) {
  const url = `${BASE}/${path}`;
  return {
    async list(params = {}) {
      const { data } = await api.get(`${url}/`, { params });
      return data.items;
    },
    async getOne(id) {
      const { data } = await api.get(`${url}/${id}`);
      return data.item;
    },
    async create(payload) {
      const { data } = await api.post(`${url}/`, payload);
      return data.item;
    },
    async update(id, payload) {
      const { data } = await api.put(`${url}/${id}`, payload);
      return data.item;
    },
    async remove(id) {
      await api.delete(`${url}/${id}`);
    },
    // Файл експорту (без id/власника/публічності) — готовий для importMany.
    async exportOne(id) {
      const { data } = await api.get(`${url}/${id}/export`);
      return data;
    },
    // Один файл експорту або масив; повертає { imported, items }.
    async importMany(payload) {
      const { data } = await api.post(`${url}/import`, payload);
      return data;
    },
  };
}

export const constellationsApi = createDocumentApi('constellations');
export const decksApi = createDocumentApi('decks');
