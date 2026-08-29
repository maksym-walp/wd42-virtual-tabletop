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

  // Події. campaignId (опційно) додає події цієї кампанії поверх глобальних
  // лор-подій (campaign_id IS NULL) — без нього повертаються лише глобальні.
  async listEvents(id, campaignId) {
    const { data } = await api.get(`${BASE}/${id}/events`, {
      params: campaignId ? { campaign_id: campaignId } : undefined,
    });
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
};

export default chronologyApi;
