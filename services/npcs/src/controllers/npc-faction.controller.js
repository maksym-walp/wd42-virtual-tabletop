const FactionModel = require('../models/faction.model');
const { canWrite, isAdmin } = require('./access');
const { findVisibleNpc } = require('./visibility');
const { loadFaction, parseRole } = require('./faction.controller');

// Faction membership seen from the NPC's side. It reads and writes the very
// same npcs.faction_members rows as /factions/:id/members, so the NPC page
// and the faction's member table never drift apart. Editing a membership is
// an edit of the faction (its owner decides who belongs), so writes need
// canWrite on the faction plus a visible NPC.
async function loadNpc(req, res) {
  const npc = await findVisibleNpc(req.params.id, req.user);
  if (!npc) { res.status(404).json({ message: 'НІПа не знайдено' }); return null; }
  return npc;
}

const NpcFactionController = {
  async list(req, res) {
    const npc = await loadNpc(req, res);
    if (!npc) return;
    const rows = await FactionModel.findMembershipsByNpc(npc.id, req.user.sub, isAdmin(req.user));
    res.json({
      factions: rows.map(({ created_by, ...row }) => ({
        ...row,
        can_edit: canWrite({ created_by }, req.user),
      })),
    });
  },

  async add(req, res) {
    const npc = await loadNpc(req, res);
    if (!npc) return;

    const { faction_id: factionId } = req.body;
    if (!factionId) return res.status(400).json({ message: 'faction_id є обовʼязковим' });
    const { role, error } = parseRole(req.body.role);
    if (error) return res.status(400).json({ message: error });

    const faction = await loadFaction(req, res, factionId, { write: true });
    if (!faction) return;

    const member = await FactionModel.addMember(faction.id, 'npc', npc.id, role);
    res.status(201).json({ member });
  },

  async update(req, res) {
    const npc = await loadNpc(req, res);
    if (!npc) return;
    const { role, error } = parseRole(req.body.role);
    if (error) return res.status(400).json({ message: error });

    const faction = await loadFaction(req, res, req.params.factionId, { write: true });
    if (!faction) return;

    const member = await FactionModel.updateMemberRole(faction.id, 'npc', npc.id, role);
    if (!member) return res.status(404).json({ message: 'НІП не є учасником цієї фракції' });
    res.json({ member });
  },

  async remove(req, res) {
    const npc = await loadNpc(req, res);
    if (!npc) return;

    const faction = await loadFaction(req, res, req.params.factionId, { write: true });
    if (!faction) return;

    await FactionModel.removeMember(faction.id, 'npc', npc.id);
    res.status(204).send();
  },
};

module.exports = NpcFactionController;
