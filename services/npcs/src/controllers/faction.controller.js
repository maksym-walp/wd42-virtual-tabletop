const FactionModel = require('../models/faction.model');
const { canCreate, canWrite, isAdmin } = require('./access');
const { isReadable, findVisibleNpc, isPersonVisible } = require('./visibility');

const MEMBER_TYPES = ['npc', 'character'];
const ROLE_MAX_LENGTH = 200;

function toModelFields(body) {
  return {
    name: body.name?.trim(),
    description: body.description ?? null,
    symbolUrl: body.symbol_url ?? null,
    isPublic: body.is_public ?? false,
  };
}

// Normalizes an optional member role: trimmed, empty -> null. Returns
// { role } or { error }.
function parseRole(raw) {
  if (raw == null) return { role: null };
  if (typeof raw !== 'string') return { error: 'role має бути рядком' };
  const role = raw.trim();
  if (role.length > ROLE_MAX_LENGTH) return { error: `role не може бути довшою за ${ROLE_MAX_LENGTH} символів` };
  return { role: role || null };
}

// Loads a faction and answers 404/403 itself when the acting user may not
// read it (or, with `write`, edit it). Returns the faction or null.
async function loadFaction(req, res, id, { write = false } = {}) {
  const faction = await FactionModel.findById(id, req.user.sub);
  if (!faction) { res.status(404).json({ message: 'Фракцію не знайдено' }); return null; }
  const allowed = write ? canWrite(faction, req.user) : isReadable(faction, req.user);
  if (!allowed) { res.status(403).json({ message: 'Доступ заборонено' }); return null; }
  return faction;
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
    const faction = await loadFaction(req, res, req.params.id);
    if (!faction) return;
    res.json({ faction });
  },

  async update(req, res) {
    const existing = await loadFaction(req, res, req.params.id, { write: true });
    if (!existing) return;

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    const faction = await FactionModel.update(existing.id, toModelFields(req.body));
    res.json({ faction });
  },

  async remove(req, res) {
    const existing = await loadFaction(req, res, req.params.id, { write: true });
    if (!existing) return;

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
    const faction = await loadFaction(req, res, req.params.id);
    if (!faction) return;
    res.json({ leaders: await FactionModel.findLeaders(faction.id) });
  },

  async addLeader(req, res) {
    const faction = await loadFaction(req, res, req.params.id, { write: true });
    if (!faction) return;

    const { npc_entry_id: npcEntryId } = req.body;
    if (!npcEntryId) return res.status(400).json({ message: 'npc_entry_id є обовʼязковим' });
    const npc = await findVisibleNpc(npcEntryId, req.user);
    if (!npc) return res.status(404).json({ message: 'НІПа не знайдено' });

    const leader = await FactionModel.addLeader(faction.id, npcEntryId);
    res.status(201).json({ leader });
  },

  async removeLeader(req, res) {
    const faction = await loadFaction(req, res, req.params.id, { write: true });
    if (!faction) return;

    await FactionModel.removeLeader(faction.id, req.params.npcId);
    res.status(204).send();
  },

  async listMembers(req, res) {
    const faction = await loadFaction(req, res, req.params.id);
    if (!faction) return;
    res.json({ members: await FactionModel.findMembers(faction.id) });
  },

  async addMember(req, res) {
    const faction = await loadFaction(req, res, req.params.id, { write: true });
    if (!faction) return;

    const { member_type: memberType, member_id: memberId } = req.body;
    if (!MEMBER_TYPES.includes(memberType)) {
      return res.status(400).json({ message: 'member_type має бути npc або character' });
    }
    if (!memberId) return res.status(400).json({ message: 'member_id є обовʼязковим' });
    const { role, error } = parseRole(req.body.role);
    if (error) return res.status(400).json({ message: error });

    if (!await isPersonVisible(memberType, memberId, req.user)) {
      return res.status(404).json({ message: 'Учасника не знайдено' });
    }

    const member = await FactionModel.addMember(faction.id, memberType, memberId, role);
    res.status(201).json({ member });
  },

  async updateMember(req, res) {
    const faction = await loadFaction(req, res, req.params.id, { write: true });
    if (!faction) return;

    const { memberType, memberId } = req.params;
    if (!MEMBER_TYPES.includes(memberType)) {
      return res.status(400).json({ message: 'member_type має бути npc або character' });
    }
    const { role, error } = parseRole(req.body.role);
    if (error) return res.status(400).json({ message: error });

    const member = await FactionModel.updateMemberRole(faction.id, memberType, memberId, role);
    if (!member) return res.status(404).json({ message: 'Учасника не знайдено' });
    res.json({ member });
  },

  async removeMember(req, res) {
    const faction = await loadFaction(req, res, req.params.id, { write: true });
    if (!faction) return;

    const { memberType, memberId } = req.params;
    if (!MEMBER_TYPES.includes(memberType)) {
      return res.status(400).json({ message: 'member_type має бути npc або character' });
    }
    await FactionModel.removeMember(faction.id, memberType, memberId);
    res.status(204).send();
  },
};

module.exports = { FactionController, loadFaction, parseRole };
