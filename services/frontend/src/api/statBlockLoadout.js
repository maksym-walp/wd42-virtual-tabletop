import api from './client';

// Loadout of a stat-block record (NPC or creature): equipment, known spells,
// known abilities. Both the npcs and bestiary services mount the same
// /:id/{equipment,spells,abilities} routes under their own record base path,
// so one factory serves both — `recordBase` is e.g. '/api/npcs/npcs'.
export function createLoadoutApi(recordBase) {
  return {
    async listEquipment(id) {
      const { data } = await api.get(`${recordBase}/${id}/equipment`);
      return data.equipment;
    },
    async addEquipment(id, equipmentId) {
      const { data } = await api.post(`${recordBase}/${id}/equipment`, { equipment_id: equipmentId });
      return data.item;
    },
    async removeEquipment(id, equipmentId) {
      await api.delete(`${recordBase}/${id}/equipment/${equipmentId}`);
    },

    async listSpells(id) {
      const { data } = await api.get(`${recordBase}/${id}/spells`);
      return data.spells;
    },
    async addSpell(id, spellId) {
      const { data } = await api.post(`${recordBase}/${id}/spells`, { spell_id: spellId });
      return data.spell;
    },
    async removeSpell(id, spellId) {
      await api.delete(`${recordBase}/${id}/spells/${spellId}`);
    },

    async listAbilities(id) {
      const { data } = await api.get(`${recordBase}/${id}/abilities`);
      return data.abilities;
    },
    async addAbility(id, abilityId) {
      const { data } = await api.post(`${recordBase}/${id}/abilities`, { ability_id: abilityId });
      return data.ability;
    },
    async removeAbility(id, abilityId) {
      await api.delete(`${recordBase}/${id}/abilities/${abilityId}`);
    },
  };
}
