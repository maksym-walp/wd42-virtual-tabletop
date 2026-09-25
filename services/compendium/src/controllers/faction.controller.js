const FactionModel = require('../models/faction.model');
const EntryModel = require('../models/entry.model');
const { canCreate, canWrite, isAdmin } = require('./access');
const { isVisibleToUser } = require('../models/catalog.model');

function toModelFields(body) {
  return {
    name: body.name?.trim(),
    description: body.description ?? null,
    symbolUrl: body.symbol_url ?? null,
    isPublic: body.is_public ?? false,
  };
}

// A faction leader must be an NPC entry visible to the acting user —
// mirrors the visibility check compendium's entry-relations controllers
// run for spells/abilities (catalog.model.js), just against compendium's
// own entries table instead of a foreign schema.
async function findVisibleNpc(npcEntryId, user) {
  const entry = await EntryModel.findById(npcEntryId, user.sub);
  if (!entry || entry.entity_type !== 'npc') return null;
  const visible = entry.is_public || entry.created_by === user.sub || isAdmin(user);
  return visible ? entry : null;
}

const FactionController = {
  async list(req, res) {
    const factions = await FactionModel.findAll(req.user.sub, isAdmin(req.user));
    res.json({ factions });
  },

  async create(req, res) {
    if (!canCreate(req.user)) {
      return res.status(403).json({ message: 'Лише майстер гри або адміністратор може створювати записи' });
    }
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    const faction = await FactionModel.create({ createdBy: req.user.sub, ...toModelFields(req.body) });
    res.status(201).json({ faction });
  },

  async getOne(req, res) {
    const faction = await FactionModel.findById(req.params.id, req.user.sub);
    if (!faction) return res.status(404).json({ message: 'Фракцію не знайдено' });
    const readable = faction.is_public || faction.created_by === req.user.sub || isAdmin(req.user);
    if (!readable) return res.status(403).json({ message: 'Доступ заборонено' });
    res.json({ faction });
  },

  async update(req, res) {
    const existing = await FactionModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Фракцію не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    const faction = await FactionModel.update(existing.id, toModelFields(req.body));
    res.json({ faction });
  },

  async remove(req, res) {
    const existing = await FactionModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Фракцію не знайдено' });
    if (!canWrite(existing, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    await FactionModel.remove(existing.id);
    res.status(204).send();
  },

  async setOwner(req, res) {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { owner_username: ownerUsername } = req.body;
    if (!ownerUsername) return res.status(400).json({ message: 'owner_username є обовʼязковим' });

    const faction = await FactionModel.setOwner(req.params.id, ownerUsername);
    if (!faction) return res.status(404).json({ message: 'Запис не знайдено або користувача з таким іменем не існує' });
    res.json({ faction });
  },

  async listLeaders(req, res) {
    const faction = await FactionModel.findById(req.params.id, req.user.sub);
    if (!faction) return res.status(404).json({ message: 'Фракцію не знайдено' });
    res.json({ leaders: await FactionModel.findLeaders(faction.id) });
  },

  async addLeader(req, res) {
    const faction = await FactionModel.findById(req.params.id);
    if (!faction) return res.status(404).json({ message: 'Фракцію не знайдено' });
    if (!canWrite(faction, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { npc_entry_id: npcEntryId } = req.body;
    if (!npcEntryId) return res.status(400).json({ message: 'npc_entry_id є обовʼязковим' });
    const npc = await findVisibleNpc(npcEntryId, req.user);
    if (!npc) return res.status(404).json({ message: 'НІПа не знайдено' });

    const leader = await FactionModel.addLeader(faction.id, npcEntryId);
    res.status(201).json({ leader });
  },

  async removeLeader(req, res) {
    const faction = await FactionModel.findById(req.params.id);
    if (!faction) return res.status(404).json({ message: 'Фракцію не знайдено' });
    if (!canWrite(faction, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    await FactionModel.removeLeader(faction.id, req.params.npcId);
    res.status(204).send();
  },

  async listMembers(req, res) {
    const faction = await FactionModel.findById(req.params.id, req.user.sub);
    if (!faction) return res.status(404).json({ message: 'Фракцію не знайдено' });
    res.json({ members: await FactionModel.findMembers(faction.id) });
  },

  async addMember(req, res) {
    const faction = await FactionModel.findById(req.params.id);
    if (!faction) return res.status(404).json({ message: 'Фракцію не знайдено' });
    if (!canWrite(faction, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { member_type: memberType, member_id: memberId } = req.body;
    if (!['npc', 'character'].includes(memberType)) {
      return res.status(400).json({ message: 'member_type має бути npc або character' });
    }
    if (!memberId) return res.status(400).json({ message: 'member_id є обовʼязковим' });

    const visible = memberType === 'npc'
      ? Boolean(await findVisibleNpc(memberId, req.user))
      : await isVisibleToUser('character_sheet.characters', memberId, req.user.sub);
    if (!visible) return res.status(404).json({ message: 'Учасника не знайдено' });

    const member = await FactionModel.addMember(faction.id, memberType, memberId);
    res.status(201).json({ member });
  },

  async removeMember(req, res) {
    const faction = await FactionModel.findById(req.params.id);
    if (!faction) return res.status(404).json({ message: 'Фракцію не знайдено' });
    if (!canWrite(faction, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { memberType, memberId } = req.params;
    await FactionModel.removeMember(faction.id, memberType, memberId);
    res.status(204).send();
  },
};

module.exports = FactionController;
