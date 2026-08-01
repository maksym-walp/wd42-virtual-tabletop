import api from './client';

const abilitiesApi = {
  // `type` isn't a column in the abilities table — every row is an ability.
  // Stamped on here so a merged вміння/маневри list (CollectionView's
  // "Додати елемент" picker) can tell the two kinds apart.
  async getAll() {
    const { data } = await api.get('/api/abilities/?limit=200');
    return (data.abilities ?? []).map((a) => ({ ...a, type: 'ability' }));
  },
};

export default abilitiesApi;
