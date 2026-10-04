const NpcModel = require('../models/npc.model');
const { isVisibleToUser } = require('../models/catalog.model');
const { isAdmin } = require('./access');

function isReadable(record, user) {
  return record.is_public || record.created_by === user.sub || isAdmin(user);
}

// An NPC the acting user may reference (as a faction leader/member or a
// relationship target): own, public, or anything for an admin.
async function findVisibleNpc(npcId, user) {
  const npc = await NpcModel.findById(npcId, user.sub);
  return npc && isReadable(npc, user) ? npc : null;
}

// Player characters live in character_sheet (cross-schema); visible when
// owned or public — same check faction members always used.
function isCharacterVisible(characterId, user) {
  return isVisibleToUser('character_sheet.characters', characterId, user.sub);
}

// member_type / target_type pairs share this: 'npc' or 'character'.
async function isPersonVisible(type, id, user) {
  if (type === 'npc') return Boolean(await findVisibleNpc(id, user));
  if (type === 'character') return isCharacterVisible(id, user);
  return false;
}

module.exports = { isReadable, findVisibleNpc, isCharacterVisible, isPersonVisible };
