const NpcModel = require('../models/npc.model');
const RelationshipModel = require('../models/relationship.model');
const { canWrite, isAdmin } = require('./access');
const { isReadable, isPersonVisible } = require('./visibility');

const TARGET_TYPES = ['npc', 'character'];
const LABEL_MAX_LENGTH = 100;

async function loadNpc(req, res, { write = false } = {}) {
  const npc = await NpcModel.findById(req.params.id, req.user.sub);
  if (!npc) { res.status(404).json({ message: 'НІПа не знайдено' }); return null; }
  const allowed = write ? canWrite(npc, req.user) : isReadable(npc, req.user);
  if (!allowed) { res.status(403).json({ message: 'Доступ заборонено' }); return null; }
  return npc;
}

// label is required (it *is* the relationship: "брат", "ворог"), note optional.
function parseText(body) {
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label) return { error: 'label є обовʼязковим' };
  if (label.length > LABEL_MAX_LENGTH) return { error: `label не може бути довшим за ${LABEL_MAX_LENGTH} символів` };
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
  return { label, note };
}

const RelationshipController = {
  async list(req, res) {
    const npc = await loadNpc(req, res);
    if (!npc) return;
    const admin = isAdmin(req.user);
    const [outgoing, incoming] = await Promise.all([
      RelationshipModel.findOutgoing(npc.id, req.user.sub, admin),
      RelationshipModel.findIncoming(npc.id, req.user.sub, admin),
    ]);
    res.json({ outgoing, incoming });
  },

  async create(req, res) {
    const npc = await loadNpc(req, res, { write: true });
    if (!npc) return;

    const { target_type: targetType, target_id: targetId } = req.body;
    if (!TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({ message: 'target_type має бути npc або character' });
    }
    if (!targetId) return res.status(400).json({ message: 'target_id є обовʼязковим' });
    if (targetType === 'npc' && targetId === npc.id) {
      return res.status(400).json({ message: 'НІП не може мати звʼязок із самим собою' });
    }
    const { label, note, error } = parseText(req.body);
    if (error) return res.status(400).json({ message: error });

    if (!await isPersonVisible(targetType, targetId, req.user)) {
      return res.status(404).json({ message: 'Персонажа не знайдено' });
    }

    const relationship = await RelationshipModel.create(npc.id, { targetType, targetId, label, note });
    if (!relationship) return res.status(409).json({ message: 'Звʼязок із цим персонажем уже існує' });
    res.status(201).json({ relationship });
  },

  async update(req, res) {
    const npc = await loadNpc(req, res, { write: true });
    if (!npc) return;
    const { label, note, error } = parseText(req.body);
    if (error) return res.status(400).json({ message: error });

    const relationship = await RelationshipModel.update(npc.id, req.params.relationshipId, { label, note });
    if (!relationship) return res.status(404).json({ message: 'Звʼязок не знайдено' });
    res.json({ relationship });
  },

  async remove(req, res) {
    const npc = await loadNpc(req, res, { write: true });
    if (!npc) return;

    const removed = await RelationshipModel.remove(npc.id, req.params.relationshipId);
    if (!removed) return res.status(404).json({ message: 'Звʼязок не знайдено' });
    res.status(204).send();
  },
};

module.exports = RelationshipController;
