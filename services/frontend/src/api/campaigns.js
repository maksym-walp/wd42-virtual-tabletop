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

  async updateDescription(id, description) {
    const { data } = await api.patch(`${BASE}/${id}/description`, { description });
    return data.campaign;
  },

  async rename(id, name) {
    const { data } = await api.patch(`${BASE}/${id}`, { name });
    return data.campaign;
  },

  async remove(id) {
    await api.delete(`${BASE}/${id}`);
  },

  async removeCharacter(id, characterId) {
    await api.delete(`${BASE}/${id}/characters/${characterId}`);
  },

  // Player leaves a campaign: detaches every character they own from it.
  async leave(id) {
    await api.post(`${BASE}/${id}/leave`);
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

  // Галерея майстра: файл спершу летить у media-service, а сюди приходить
  // уже готовий URL — саме цей запис і робить зображення власністю кампанії.
  async listGallery(id) {
    const { data } = await api.get(`${BASE}/${id}/gallery`);
    return data.images;
  },

  async addGalleryImage(id, image_url) {
    const { data } = await api.post(`${BASE}/${id}/gallery`, { image_url });
    return data.image;
  },

  async removeGalleryImage(id, imageId) {
    await api.delete(`${BASE}/${id}/gallery/${imageId}`);
  },

  // Map "cards": a campaign references standalone maps (maps live in the maps
  // service; here we only keep links to them).
  async listMapCards(id) {
    const { data } = await api.get(`${BASE}/${id}/maps`);
    return data.maps;
  },

  async addMapCard(id, map_id) {
    const { data } = await api.post(`${BASE}/${id}/maps`, { map_id });
    return data.card;
  },

  async removeMapCard(id, cardId) {
    await api.delete(`${BASE}/${id}/maps/${cardId}`);
  },

  // Session recaps: GM-authored notes about past sessions.
  async listSessions(id) {
    const { data } = await api.get(`${BASE}/${id}/sessions`);
    return data.sessions;
  },

  async addSession(id, payload) {
    const { data } = await api.post(`${BASE}/${id}/sessions`, payload);
    return data.session;
  },

  async updateSession(id, sessionId, payload) {
    const { data } = await api.patch(`${BASE}/${id}/sessions/${sessionId}`, payload);
    return data.session;
  },

  async removeSession(id, sessionId) {
    await api.delete(`${BASE}/${id}/sessions/${sessionId}`);
  },

  // Combat tracker: поточна сцена бою + комбатанти. Для гравців бекенд сам
  // урізає приховані (is_hidden) NPC до {id, name, description, is_hidden}.
  async getCombat(id) {
    const { data } = await api.get(`${BASE}/${id}/combat`);
    return data;
  },

  async nextTurn(id) {
    const { data } = await api.post(`${BASE}/${id}/combat/next-turn`);
    return data.combatant;
  },

  async nextRound(id) {
    const { data } = await api.post(`${BASE}/${id}/combat/next-round`);
    return data.scene;
  },

  async createCombatScene(id, payload) {
    const { data } = await api.post(`${BASE}/${id}/combat/scenes`, payload);
    return data.scene;
  },

  async updateCombatScene(id, sceneId, payload) {
    const { data } = await api.patch(`${BASE}/${id}/combat/scenes/${sceneId}`, payload);
    return data.scene;
  },

  async removeCombatScene(id, sceneId) {
    await api.delete(`${BASE}/${id}/combat/scenes/${sceneId}`);
  },

  async addCombatant(id, sceneId, payload) {
    const { data } = await api.post(`${BASE}/${id}/combat/scenes/${sceneId}/combatants`, payload);
    return data.combatant;
  },

  async updateCombatant(id, combatantId, payload) {
    const { data } = await api.patch(`${BASE}/${id}/combat/combatants/${combatantId}`, payload);
    return data.combatant;
  },

  async removeCombatant(id, combatantId) {
    await api.delete(`${BASE}/${id}/combat/combatants/${combatantId}`);
  },
};

export default campaignApi;
