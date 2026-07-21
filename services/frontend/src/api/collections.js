import api from './client';

// Factory since each domain (equipment/abilities/maneuvers/spellbook) runs its
// own collections module on its own service, at its own /collections base path.
export function createCollectionsApi(base) {
  return {
    async getAll({ search, scope } = {}) {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (scope) params.set('scope', scope);
      const qs = params.toString();
      const { data } = await api.get(`${base}${qs ? `?${qs}` : ''}`);
      return data.collections ?? [];
    },
    async getOne(id) {
      const { data } = await api.get(`${base}${id}`);
      return data.collection;
    },
    async getPublic(id) {
      const { data } = await api.get(`${base}public/${id}`);
      return data.collection;
    },
    async create(payload) {
      const { data } = await api.post(base, payload);
      return data.collection;
    },
    async update(id, payload) {
      const { data } = await api.put(`${base}${id}`, payload);
      return data.collection;
    },
    async remove(id) {
      await api.delete(`${base}${id}`);
    },
    async setCanonical(id, isCanonical = true) {
      const { data } = await api.patch(`${base}${id}/canonical`, { is_canonical: isCanonical });
      return data.collection;
    },
    async addItem(collectionId, itemIdField, itemId) {
      const { data } = await api.post(`${base}${collectionId}/items`, { [itemIdField]: itemId });
      return data.item;
    },
    async removeItem(collectionId, itemId) {
      await api.delete(`${base}${collectionId}/items/${itemId}`);
    },
  };
}
