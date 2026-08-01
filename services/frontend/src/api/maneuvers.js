import api from './client';

const maneuversApi = {
  // `type` isn't a column in the maneuvers table — every row is a maneuver.
  // Stamped on here so a merged вміння/маневри list (CollectionView's
  // "Додати елемент" picker) can tell the two kinds apart.
  async getAll() {
    const { data } = await api.get('/api/abilities/maneuvers/?limit=200');
    return (data.maneuvers ?? []).map((m) => ({ ...m, type: 'maneuver' }));
  },
};

export default maneuversApi;
