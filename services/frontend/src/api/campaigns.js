import api from './client';

const BASE = '/api/campaigns';

const campaignApi = {
  async list() {
    const { data } = await api.get(BASE + '/');
    return data.campaigns;
  },

  async create(payload) {
    const { data } = await api.post(BASE + '/', payload);
    return data.campaign;
  },

  async getOne(id) {
    const { data } = await api.get(`${BASE}/${id}`);
    return data.campaign;
  },

  async updateSharedNotes(id, shared_notes) {
    const { data } = await api.patch(`${BASE}/${id}/shared-notes`, { shared_notes });
    return data.campaign;
  },

  async updateGmNotes(id, gm_notes) {
    const { data } = await api.patch(`${BASE}/${id}/gm-notes`, { gm_notes });
    return data.campaign;
  },

  // Спосіб А: гравець приєднує власного персонажа за кодом-запрошенням
  async join(invite_code, character_id) {
    const { data } = await api.post(`${BASE}/join`, { invite_code, character_id });
    return data;
  },

  // Спосіб Б: майстер напряму додає character_id до своєї кампанії
  async addCharacter(id, character_id) {
    const { data } = await api.post(`${BASE}/${id}/characters`, { character_id });
    return data;
  },

  async listCharacters(id) {
    const { data } = await api.get(`${BASE}/${id}/characters`);
    return data.characters;
  },
};

export default campaignApi;
