import api from './client';

const BASE = '/api/campaigns';

const campaignApi = {
  // scope='all' — адмін отримує всі кампанії (для інших бекенд ігнорує).
  async list({ scope } = {}) {
    const { data } = await api.get(BASE + '/', { params: scope ? { scope } : undefined });
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

  // Прив'язка календаря й поточна дата кампанії (усі чотири поля йдуть
  // разом — див. 60-campaign-time-tracking.sql / CampaignController.updateCurrentDate).
  async updateCurrentDate(id, { calendar_id, current_year, current_month_id, current_day }) {
    const { data } = await api.patch(`${BASE}/${id}/date`, { calendar_id, current_year, current_month_id, current_day });
    return data.campaign;
  },

  async regenerateInviteCode(id) {
    const { data } = await api.post(`${BASE}/${id}/invite-code/regenerate`);
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

  // Майстер видає N пунктів досвіду одразу всім персонажам кампанії.
  async grantExperience(id, amount) {
    const { data } = await api.post(`${BASE}/${id}/characters/experience`, { amount });
    return data; // { updated: <count> }
  },

  // Стіл (zone='table') і Ширма (zone='screen'). Записи каталогів бекенд
  // зберігає знімком картки (назва, зображення, опис) — гравці бачать лише
  // його. Гравцеві повертаються тільки видимі записи Столу.
  async listBoard(id, zone = 'table') {
    const { data } = await api.get(`${BASE}/${id}/board`, { params: { zone } });
    return data.items;
  },

  // { zone, kind, ref_id?, ref_subtype?, title?, content?, image_url?, is_visible? }
  async addBoardItem(id, payload) {
    const { data } = await api.post(`${BASE}/${id}/board`, payload);
    return data.item;
  },

  // { zone?, is_visible?, is_featured?, title?, subtitle?, content?, image_url? }
  async updateBoardItem(id, itemId, payload) {
    const { data } = await api.patch(`${BASE}/${id}/board/${itemId}`, payload);
    return data.item;
  },

  async refreshBoardItem(id, itemId) {
    const { data } = await api.post(`${BASE}/${id}/board/${itemId}/refresh`);
    return data.item;
  },

  async reorderBoard(id, zone, ids) {
    await api.put(`${BASE}/${id}/board/order`, { zone, ids });
  },

  async removeBoardItem(id, itemId) {
    await api.delete(`${BASE}/${id}/board/${itemId}`);
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

  // Clones `quantity` independent combatant rows from one compendium entry
  // (e.g. 3 Goblins) — the backend computes each row's starting health/
  // active_defense/initiative from the entry's attributes, so no stats are
  // sent here, just which entry and how many.
  async addCombatantsFromCompendium(id, sceneId, { compendium_entry_id, quantity }) {
    const { data } = await api.post(`${BASE}/${id}/combat/scenes/${sceneId}/combatants`, {
      compendium_entry_id, quantity,
    });
    return data.combatants;
  },

  async updateCombatant(id, combatantId, payload) {
    const { data } = await api.patch(`${BASE}/${id}/combat/combatants/${combatantId}`, payload);
    return data.combatant;
  },

  async removeCombatant(id, combatantId) {
    await api.delete(`${BASE}/${id}/combat/combatants/${combatantId}`);
  },

  // Зворотний бік двосторонньої синхронізації ХП: лист персонажа сповіщає
  // сюди, а бекенд сам знаходить усіх комбатантів цього персонажа (в будь-
  // якій кампанії/сцені) й оновлює їхнє health/temp_hp.
  async syncCombatantHp(characterId, { health, temp_hp }) {
    const { data } = await api.patch(`${BASE}/characters/${characterId}/hp`, { health, temp_hp });
    return data.combatants;
  },
};

export default campaignApi;
