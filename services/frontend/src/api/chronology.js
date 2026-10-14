import api from './client';

// Сервіс зветься "chronology" (перейменований з "calendar") — так само, як
// admin/media/compendium; шлях /chronology у роутері фронтенду збігається з
// цим базовим шляхом лише за назвою, не технічно.
const BASE = '/api/chronology';

const chronologyApi = {
  async list() {
    const { data } = await api.get(`${BASE}/`);
    return data.calendars;
  },

  async getOne(id) {
    const { data } = await api.get(`${BASE}/${id}`);
    return data.calendar;
  },

  async create(payload) {
    const { data } = await api.post(`${BASE}/`, payload);
    return data.calendar;
  },

  async update(id, payload) {
    const { data } = await api.put(`${BASE}/${id}`, payload);
    return data.calendar;
  },

  async remove(id) {
    await api.delete(`${BASE}/${id}`);
  },

  // Лише адмін: зробити календар (не)основним — він обраний наперед у всіх
  // вибірах дати. Повертає оновлений календар.
  async setDefault(id, isDefault) {
    const { data } = await api.put(`${BASE}/${id}/default`, { is_default: isDefault });
    return data.calendar;
  },

  // Зсув синхронізації з календарем за замовчуванням (null — вимкнути).
  async setSync(id, syncOffsetDays) {
    const { data } = await api.put(`${BASE}/${id}/sync`, { sync_offset_days: syncOffsetDays });
    return data.calendar;
  },

  // Структура календаря (без подій) у плоскому JSON для іншого рушія.
  async exportStructure(id) {
    const { data } = await api.get(`${BASE}/${id}/export`);
    return data;
  },

  // Місяці
  async listMonths(id) {
    const { data } = await api.get(`${BASE}/${id}/months`);
    return data.months;
  },
  async createMonth(id, payload) {
    const { data } = await api.post(`${BASE}/${id}/months`, payload);
    return data.month;
  },
  async updateMonth(id, monthId, payload) {
    const { data } = await api.put(`${BASE}/${id}/months/${monthId}`, payload);
    return data.month;
  },
  async removeMonth(id, monthId) {
    await api.delete(`${BASE}/${id}/months/${monthId}`);
  },

  // Дні тижня
  async listWeekdays(id) {
    const { data } = await api.get(`${BASE}/${id}/weekdays`);
    return data.weekdays;
  },
  async createWeekday(id, payload) {
    const { data } = await api.post(`${BASE}/${id}/weekdays`, payload);
    return data.weekday;
  },
  async updateWeekday(id, weekdayId, payload) {
    const { data } = await api.put(`${BASE}/${id}/weekdays/${weekdayId}`, payload);
    return data.weekday;
  },
  async removeWeekday(id, weekdayId) {
    await api.delete(`${BASE}/${id}/weekdays/${weekdayId}`);
  },

  // Сезони
  async listSeasons(id) {
    const { data } = await api.get(`${BASE}/${id}/seasons`);
    return data.seasons;
  },
  async createSeason(id, payload) {
    const { data } = await api.post(`${BASE}/${id}/seasons`, payload);
    return data.season;
  },
  async updateSeason(id, seasonId, payload) {
    const { data } = await api.put(`${BASE}/${id}/seasons/${seasonId}`, payload);
    return data.season;
  },
  async removeSeason(id, seasonId) {
    await api.delete(`${BASE}/${id}/seasons/${seasonId}`);
  },

  // Супутники
  async listMoons(id) {
    const { data } = await api.get(`${BASE}/${id}/moons`);
    return data.moons;
  },
  async createMoon(id, payload) {
    const { data } = await api.post(`${BASE}/${id}/moons`, payload);
    return data.moon;
  },
  async updateMoon(id, moonId, payload) {
    const { data } = await api.put(`${BASE}/${id}/moons/${moonId}`, payload);
    return data.moon;
  },
  async removeMoon(id, moonId) {
    await api.delete(`${BASE}/${id}/moons/${moonId}`);
  },

  // Ери (понад основну: current_era_name/previous_era_name)
  async listEras(id) {
    const { data } = await api.get(`${BASE}/${id}/eras`);
    return data.eras;
  },
  async createEra(id, payload) {
    const { data } = await api.post(`${BASE}/${id}/eras`, payload);
    return data.era;
  },
  async updateEra(id, eraId, payload) {
    const { data } = await api.put(`${BASE}/${id}/eras/${eraId}`, payload);
    return data.era;
  },
  async removeEra(id, eraId) {
    await api.delete(`${BASE}/${id}/eras/${eraId}`);
  },

  // Події. campaignId (опційно) додає події цієї кампанії поверх глобальних
  // лор-подій (campaign_id IS NULL) — без нього повертаються лише глобальні.
  // synced: true — разом із подіями інших синхронізованих календарів (для
  // синхронізованого; їхня дата перераховується через chronologySync.js).
  async listEvents(id, campaignId, { synced = false } = {}) {
    const params = {};
    if (campaignId) params.campaign_id = campaignId;
    if (synced) params.scope = 'synced';
    const { data } = await api.get(`${BASE}/${id}/events`, { params });
    return data.events;
  },
  async createEvent(id, payload) {
    const { data } = await api.post(`${BASE}/${id}/events`, payload);
    return data.event;
  },
  async updateEvent(id, eventId, payload) {
    const { data } = await api.put(`${BASE}/${id}/events/${eventId}`, payload);
    return data.event;
  },
  async removeEvent(id, eventId) {
    await api.delete(`${BASE}/${id}/events/${eventId}`);
  },

  // Усі видимі події (у всіх календарях), де entryId — учасник (НІП/істота).
  // Кожна подія несе calendar_name/month_name/end_month_name для підпису дати.
  async listEventsByParticipant(entryId) {
    const { data } = await api.get(`${BASE}/events/by-participant/${entryId}`);
    return data.events;
  },
  async addEventParticipant(id, eventId, entryId) {
    await api.post(`${BASE}/${id}/events/${eventId}/participants`, { entry_id: entryId });
  },
  async removeEventParticipant(id, eventId, entryId) {
    await api.delete(`${BASE}/${id}/events/${eventId}/participants/${entryId}`);
  },
};

export default chronologyApi;
