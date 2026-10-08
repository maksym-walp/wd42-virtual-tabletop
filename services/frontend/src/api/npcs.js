import api from './client';
import { createLoadoutApi } from './statBlockLoadout';

const BASE = '/api/npcs';
const NPCS = `${BASE}/npcs`;

// НІПи та фракції — власні + публічні (адміну видно все), запис обмежений
// роллю game_master/admin на сервері. Кожен НІП несе is_owner та обчислені
// `skills`/`health`.
const npcsApi = {
  async list() {
    const { data } = await api.get(NPCS);
    return data.npcs;
  },
  async get(id) {
    const { data } = await api.get(`${NPCS}/${id}`);
    return data.npc;
  },
  async create(payload) {
    const { data } = await api.post(NPCS, payload);
    return data.npc;
  },
  async update(id, payload) {
    const { data } = await api.patch(`${NPCS}/${id}`, payload);
    return data.npc;
  },
  async remove(id) {
    await api.delete(`${NPCS}/${id}`);
  },
  async setOwner(id, ownerUsername) {
    const { data } = await api.patch(`${NPCS}/${id}/owner`, { owner_username: ownerUsername });
    return data.npc;
  },

  // Persists a rolled health-dice total; pass null to clear a previous roll.
  // Narrow endpoint: touches only rolled_health, unlike update which
  // rewrites the whole row from a full form submission.
  async updateHealth(id, rolledHealth) {
    const { data } = await api.patch(`${NPCS}/${id}/health`, { rolled_health: rolledHealth });
    return data.npc;
  },

  ...createLoadoutApi(NPCS),

  // Членство у фракціях з боку НІПа — ті самі рядки, що й учасники на
  // сторінці фракції, тож обидва місця завжди показують одне й те саме.
  async listNpcFactions(id) {
    const { data } = await api.get(`${NPCS}/${id}/factions`);
    return data.factions;
  },
  async joinFaction(id, factionId, role) {
    const { data } = await api.post(`${NPCS}/${id}/factions`, { faction_id: factionId, role });
    return data.member;
  },
  async updateFactionRole(id, factionId, role) {
    const { data } = await api.patch(`${NPCS}/${id}/factions/${factionId}`, { role });
    return data.member;
  },
  async leaveFaction(id, factionId) {
    await api.delete(`${NPCS}/${id}/factions/${factionId}`);
  },

  // Звʼязки: outgoing — від цього НІПа до НІПа/персонажа; incoming — інші
  // НІПи, що вказали звʼязок із цим.
  async listRelationships(id) {
    const { data } = await api.get(`${NPCS}/${id}/relationships`);
    return data;
  },
  async addRelationship(id, { targetType, targetId, label, note }) {
    const { data } = await api.post(`${NPCS}/${id}/relationships`, {
      target_type: targetType, target_id: targetId, label, note,
    });
    return data.relationship;
  },
  async updateRelationship(id, relationshipId, { label, note }) {
    const { data } = await api.patch(`${NPCS}/${id}/relationships/${relationshipId}`, { label, note });
    return data.relationship;
  },
  async removeRelationship(id, relationshipId) {
    await api.delete(`${NPCS}/${id}/relationships/${relationshipId}`);
  },

  // Звʼязки й фракції з боку персонажа гравця (вкладка «Наратив» листа).
  async listCharacterRelationships(characterId) {
    const { data } = await api.get(`${BASE}/characters/${characterId}/relationships`);
    return data.relationships;
  },
  async listCharacterFactions(characterId) {
    const { data } = await api.get(`${BASE}/characters/${characterId}/factions`);
    return data.factions;
  },

  // Factions
  async listFactions() {
    const { data } = await api.get(`${BASE}/factions`);
    return data.factions;
  },
  async getFaction(id) {
    const { data } = await api.get(`${BASE}/factions/${id}`);
    return data.faction;
  },
  async createFaction(payload) {
    const { data } = await api.post(`${BASE}/factions`, payload);
    return data.faction;
  },
  async updateFaction(id, payload) {
    const { data } = await api.patch(`${BASE}/factions/${id}`, payload);
    return data.faction;
  },
  async removeFaction(id) {
    await api.delete(`${BASE}/factions/${id}`);
  },
  async setFactionOwner(id, ownerUsername) {
    const { data } = await api.patch(`${BASE}/factions/${id}/owner`, { owner_username: ownerUsername });
    return data.faction;
  },

  async listFactionLeaders(factionId) {
    const { data } = await api.get(`${BASE}/factions/${factionId}/leaders`);
    return data.leaders;
  },
  async addFactionLeader(factionId, npcId) {
    const { data } = await api.post(`${BASE}/factions/${factionId}/leaders`, { npc_entry_id: npcId });
    return data.leader;
  },
  async removeFactionLeader(factionId, npcId) {
    await api.delete(`${BASE}/factions/${factionId}/leaders/${npcId}`);
  },

  async listFactionMembers(factionId) {
    const { data } = await api.get(`${BASE}/factions/${factionId}/members`);
    return data.members;
  },
  async addFactionMember(factionId, memberType, memberId, role) {
    const { data } = await api.post(`${BASE}/factions/${factionId}/members`, {
      member_type: memberType, member_id: memberId, role,
    });
    return data.member;
  },
  async updateFactionMember(factionId, memberType, memberId, role) {
    const { data } = await api.patch(`${BASE}/factions/${factionId}/members/${memberType}/${memberId}`, { role });
    return data.member;
  },
  async removeFactionMember(factionId, memberType, memberId) {
    await api.delete(`${BASE}/factions/${factionId}/members/${memberType}/${memberId}`);
  },
};

export default npcsApi;
